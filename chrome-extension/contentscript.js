/**
 * HM Comment - Content Script
 * Injects an HM Comment button on each LinkedIn post for AI-powered comment generation.
 * Communicates with background.js service worker for n8n API calls.
 */

console.log('HM Comment content script loaded');

// ─── Post selectors (multiple fallbacks for LinkedIn DOM changes) ───
const POST_SELECTORS = [
  '.feed-shared-update-v2',
  '[data-urn^="urn:li:activity"]',
  '.occludable-update'
];

const POST_TEXT_SELECTORS = [
  '.feed-shared-update-v2__commentary .break-words',
  '.feed-shared-update-v2__commentary',
  '.feed-shared-text .break-words',
  '.feed-shared-text',
  '.update-components-text .break-words',
  '.update-components-text'
];

const COMMENT_TEXT_SELECTORS = [
  '.comments-comment-item__main-content',
  '.comments-comment-texteditor__content'
];

const ACTION_BAR_SELECTORS = [
  '.feed-shared-social-actions',
  '.social-details-social-actions',
  '.feed-shared-social-action-bar'
];

const AUTHOR_NAME_SELECTORS = [
  '.update-components-actor__name .visually-hidden',
  '.update-components-actor__name',
  '.feed-shared-actor__name .visually-hidden',
  '.feed-shared-actor__name'
];

const COMMENT_BUTTON_SELECTORS = [
  'button[aria-label*="Comment"]',
  'button[aria-label*="comment"]',
  '.comment-button',
  'button.feed-shared-social-action-bar__action-btn:nth-child(2)'
];

const COMMENT_BOX_SELECTORS = [
  '.comments-comment-texteditor [contenteditable="true"]',
  '.comments-comment-box [contenteditable="true"]',
  '.ql-editor[contenteditable="true"]'
];

// ─── State ───
let currentOverlay = null;

// ─── Utility: query with fallback selectors ───
function queryWithFallbacks(root, selectors) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function queryAllWithFallbacks(root, selectors) {
  for (const sel of selectors) {
    const els = root.querySelectorAll(sel);
    if (els.length > 0) return els;
  }
  return [];
}

// ─── Find all post elements on the page ───
function findPostElements() {
  for (const sel of POST_SELECTORS) {
    const posts = document.querySelectorAll(sel);
    if (posts.length > 0) return Array.from(posts);
  }
  return [];
}

// ─── Inject HM Comment button on a single post ───
function injectGenieButton(postEl) {
  if (postEl.dataset.genieInjected === 'true') return;
  postEl.dataset.genieInjected = 'true';

  const actionBar = queryWithFallbacks(postEl, ACTION_BAR_SELECTORS);
  if (!actionBar) {
    // Non-critical: some posts (ads, promoted) don't have action bars
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'genie-btn';
  btn.innerHTML = '<span class="genie-icon">💬</span><span class="genie-label">HM</span>';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGenieClick(postEl);
  });

  actionBar.appendChild(btn);
}

// ─── Extract data from a specific post ───
function extractPostData(postEl) {
  // Post text
  let postText = '';
  const textEl = queryWithFallbacks(postEl, POST_TEXT_SELECTORS);
  if (textEl) {
    postText = textEl.innerText.trim();
  }

  // Author name
  let authorName = '';
  const authorEl = queryWithFallbacks(postEl, AUTHOR_NAME_SELECTORS);
  if (authorEl) {
    authorName = authorEl.innerText.trim();
  }

  // Existing comments
  const comments = [];
  const commentEls = queryAllWithFallbacks(postEl, COMMENT_TEXT_SELECTORS);
  commentEls.forEach(el => {
    const text = el.innerText.trim();
    if (text) comments.push(text);
  });

  // Post type detection
  let postType = 'text';
  if (postEl.querySelector('.feed-shared-article')) postType = 'article';
  else if (postEl.querySelector('.feed-shared-image')) postType = 'image';
  else if (postEl.querySelector('video, .feed-shared-linkedin-video')) postType = 'video';
  else if (postEl.querySelector('.feed-shared-mini-update')) postType = 'reshare';

  return { postText, authorName, comments, postType };
}

// ─── Handle HM Comment button click ───
function onGenieClick(postEl) {
  const data = extractPostData(postEl);

  if (!data.postText || data.postText === '') {
    showModal(postEl, {
      error: true,
      message: 'Could not extract post text. Try clicking into the post first.'
    });
    return;
  }

  // Show modal with loading state
  showModal(postEl, { loading: true });

  // Get tone preference then call background worker
  chrome.storage.sync.get({ tone: 'tony' }, (settings) => {
    const payload = {
      postText: data.postText.substring(0, 3000),
      comments: data.comments.slice(0, 10),
      authorName: data.authorName,
      postType: data.postType,
      tone: settings.tone
    };

    chrome.runtime.sendMessage(
      { type: 'generateComments', payload },
      (response) => {
        if (chrome.runtime.lastError) {
          updateModal({
            error: true,
            message: 'Extension error. Try reloading the page.'
          });
          return;
        }

        if (response && response.success && response.data) {
          updateModal({ suggestions: response.data, postEl });
        } else {
          updateModal({
            error: true,
            message: response?.error || 'Failed to generate comments. Check your n8n webhook.',
            retryPayload: payload
          });
        }
      }
    );
  });
}

// ─── Show Modal ───
function showModal(postEl, state) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'genie-overlay';
  overlay.id = 'genie-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const modal = document.createElement('div');
  modal.className = 'genie-modal';
  modal.id = 'genie-modal';

  // Header
  const header = document.createElement('div');
  header.className = 'genie-header';
  header.innerHTML = `
    <h3 class="genie-header-title">HM Comment</h3>
    <button class="genie-close-btn" id="genie-close">✕</button>
  `;
  modal.appendChild(header);

  // Tone selector
  const toneBar = document.createElement('div');
  toneBar.className = 'genie-tone-bar';
  toneBar.innerHTML = `
    <span class="genie-tone-label">TONE</span>
    <select class="genie-tone-select" id="genie-tone">
      <option value="tony">Tony's Voice</option>
      <option value="hormozi">Hormozi Style</option>
      <option value="professional">Professional</option>
      <option value="casual">Casual</option>
    </select>
  `;
  modal.appendChild(toneBar);

  // Set current tone
  chrome.storage.sync.get({ tone: 'tony' }, (settings) => {
    const select = document.getElementById('genie-tone');
    if (select) select.value = settings.tone;
  });

  // Body
  const body = document.createElement('div');
  body.className = 'genie-body';
  body.id = 'genie-body';
  modal.appendChild(body);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  currentOverlay = overlay;

  // Close button
  document.getElementById('genie-close').addEventListener('click', closeModal);

  // Tone change handler
  document.getElementById('genie-tone').addEventListener('change', (e) => {
    const newTone = e.target.value;
    chrome.storage.sync.set({ tone: newTone });

    // Re-generate with new tone
    updateModal({ loading: true });
    const data = extractPostData(postEl);
    const payload = {
      postText: data.postText.substring(0, 3000),
      comments: data.comments.slice(0, 10),
      authorName: data.authorName,
      postType: data.postType,
      tone: newTone
    };

    chrome.runtime.sendMessage(
      { type: 'generateComments', payload },
      (response) => {
        if (response && response.success && response.data) {
          updateModal({ suggestions: response.data, postEl });
        } else {
          updateModal({
            error: true,
            message: response?.error || 'Failed to generate comments.',
            retryPayload: payload
          });
        }
      }
    );
  });

  // Render initial state
  if (state.loading) {
    updateModal({ loading: true });
  } else if (state.error) {
    updateModal({ error: true, message: state.message });
  }
}

// ─── Update Modal Body ───
function updateModal(state) {
  const body = document.getElementById('genie-body');
  if (!body) return;
  body.innerHTML = '';

  if (state.loading) {
    body.innerHTML = `
      <div class="genie-loading">
        <div class="genie-spinner"></div>
        <div class="genie-loading-text">Generating comments...</div>
      </div>
    `;
    return;
  }

  if (state.error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'genie-error';
    errorDiv.innerHTML = `<div class="genie-error-text">${state.message}</div>`;

    if (state.retryPayload) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'genie-retry-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => {
        updateModal({ loading: true });
        chrome.runtime.sendMessage(
          { type: 'generateComments', payload: state.retryPayload },
          (response) => {
            if (response && response.success && response.data) {
              updateModal({ suggestions: response.data, postEl: state.postEl });
            } else {
              updateModal({
                error: true,
                message: response?.error || 'Still failing. Check n8n webhook.',
                retryPayload: state.retryPayload
              });
            }
          }
        );
      });
      errorDiv.appendChild(retryBtn);
    }

    body.appendChild(errorDiv);
    return;
  }

  if (state.suggestions) {
    state.suggestions.forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.className = 'genie-suggestion';

      const typeLabel = document.createElement('div');
      typeLabel.className = 'genie-suggestion-type';
      typeLabel.textContent = suggestion.type === 'short' ? 'Quick' : 'Detailed';
      btn.appendChild(typeLabel);

      const textSpan = document.createElement('span');
      textSpan.textContent = suggestion.text;
      btn.appendChild(textSpan);

      btn.addEventListener('click', () => {
        insertComment(state.postEl, suggestion.text);
      });

      body.appendChild(btn);
    });
  }
}

// ─── Close Modal ───
function closeModal() {
  const overlay = document.getElementById('genie-overlay');
  if (overlay) overlay.remove();
  currentOverlay = null;
}

// ─── Insert Comment into LinkedIn ───
async function insertComment(postEl, text) {
  if (!postEl) {
    closeModal();
    return;
  }

  // Step 1: Click LinkedIn's Comment button to expand comment section
  const commentBtn = queryWithFallbacks(postEl, COMMENT_BUTTON_SELECTORS);
  if (commentBtn) {
    commentBtn.click();
  }

  // Step 2: Wait for comment box to appear (scoped to this post)
  const commentBox = await waitForElement(postEl, COMMENT_BOX_SELECTORS, 3000);

  if (commentBox) {
    // Focus and insert using execCommand for LinkedIn's state to recognize it
    commentBox.focus();

    // Clear any existing content
    commentBox.innerHTML = '';

    // Use execCommand so LinkedIn's internal editor state updates
    document.execCommand('insertText', false, text);

    // Dispatch input event as backup
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));

    closeModal();
    console.log('HM Comment: Comment inserted successfully');
  } else {
    // Fallback: try document-wide
    const fallbackBox = document.querySelector('[contenteditable="true"].ql-editor') ||
                        document.querySelector('.comments-comment-texteditor [contenteditable="true"]');
    if (fallbackBox) {
      fallbackBox.focus();
      fallbackBox.innerHTML = '';
      document.execCommand('insertText', false, text);
      fallbackBox.dispatchEvent(new Event('input', { bubbles: true }));
      closeModal();
    } else {
      // Copy to clipboard as last resort
      navigator.clipboard.writeText(text).then(() => {
        updateModal({
          error: true,
          message: 'Could not find the comment box. The comment has been copied to your clipboard - paste it manually.'
        });
      }).catch(() => {
        updateModal({
          error: true,
          message: 'Could not find the comment box. Try clicking Comment on the post first, then use HM Comment.'
        });
      });
    }
  }
}

// ─── Wait for element to appear in DOM ───
function waitForElement(root, selectors, timeout = 3000) {
  return new Promise((resolve) => {
    // Check immediately
    const existing = queryWithFallbacks(root, selectors);
    if (existing) {
      resolve(existing);
      return;
    }

    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      const el = queryWithFallbacks(root, selectors);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (elapsed >= timeout) {
        clearInterval(timer);
        resolve(null);
      }
    }, interval);
  });
}

// ─── MutationObserver: watch for new posts ───
function observeFeed() {
  // Inject on all currently visible posts
  const posts = findPostElements();
  posts.forEach(injectGenieButton);

  // Watch for new posts loaded via infinite scroll
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Check if the added node itself is a post
        for (const sel of POST_SELECTORS) {
          if (node.matches && node.matches(sel)) {
            injectGenieButton(node);
          }
        }

        // Check children of the added node
        if (node.querySelectorAll) {
          const childPosts = findPostsIn(node);
          childPosts.forEach(injectGenieButton);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}

function findPostsIn(root) {
  const results = [];
  for (const sel of POST_SELECTORS) {
    root.querySelectorAll(sel).forEach(el => results.push(el));
    if (results.length > 0) return results;
  }
  return results;
}

// ─── Initialize ───
function init() {
  console.log('HM Comment: Initializing...');

  // Wait a moment for LinkedIn to render
  setTimeout(() => {
    observeFeed();
    console.log('HM Comment: Ready.');
  }, 1500);

  // Re-scan on URL changes (LinkedIn is a SPA)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('HM Comment: URL changed, re-scanning...');
      setTimeout(() => {
        const posts = findPostElements();
        posts.forEach(injectGenieButton);
      }, 2000);
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });
}

// Start when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
