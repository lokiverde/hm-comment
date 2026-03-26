/**
 * HM Comment - Content Script
 * Injects an HM Comment button on each LinkedIn post for AI-powered comment generation.
 * Communicates with background.js service worker for n8n API calls.
 *
 * Updated 2026-03-25: LinkedIn moved to hashed/obfuscated class names.
 * All selectors now use role attributes, aria-labels, and structural navigation.
 */

console.log('HM Comment content script loaded');

// ─── Post selectors (role-based, stable across LinkedIn deploys) ───
const POST_SELECTOR = '[role="listitem"]';
const FEED_SELECTOR = '[role="list"]';

// ─── State ───
let currentOverlay = null;

// ─── Find all post elements on the page ───
function findPostElements() {
  // Find all listitems, then filter to only those that contain a post
  // (have a control menu button or a Comment button)
  const allItems = document.querySelectorAll(POST_SELECTOR);
  const posts = [];
  for (const item of allItems) {
    const hasMenu = item.querySelector('button[aria-label^="Open control menu for post"]');
    if (hasMenu) posts.push(item);
  }
  return posts;
}

// ─── Find the Comment button inside a post (no aria-label, text match only) ───
function findCommentButton(postEl) {
  const buttons = postEl.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent.trim();
    if (text === 'Comment') return btn;
  }
  // Fallback: aria-label based (in case LinkedIn adds it back)
  return postEl.querySelector('button[aria-label*="Comment" i]');
}

// ─── Find the action bar (parent container of Like/Comment/Repost buttons) ───
function findActionBar(postEl) {
  const commentBtn = findCommentButton(postEl);
  if (commentBtn) {
    // Walk up to find the bar containing all action buttons.
    // The action bar is typically 2-3 levels up from the Comment button.
    let bar = commentBtn.parentElement;
    while (bar && bar !== postEl) {
      // The action bar is the div that contains both Like and Comment buttons
      const hasLike = bar.querySelector('button[aria-label^="Reaction button"]');
      const hasComment = findCommentButton(bar);
      if (hasLike && hasComment) return bar;
      bar = bar.parentElement;
    }
    // Fallback: return the immediate parent of the comment button
    return commentBtn.parentElement;
  }
  return null;
}

// ─── Extract author name from control menu button aria-label ───
function extractAuthorName(postEl) {
  const menuBtn = postEl.querySelector('button[aria-label^="Open control menu for post by"]');
  if (menuBtn) {
    return menuBtn.getAttribute('aria-label').replace('Open control menu for post by ', '').trim();
  }
  return '';
}

// ─── Extract post text ───
function extractPostText(postEl) {
  // Strategy 1: Find the longest <p> or <span> with substantial text inside the post.
  // LinkedIn puts post text in a <p> tag or nested spans.
  // Skip buttons, the author section, and social counts.
  let bestText = '';

  // Check all <p> elements
  const paragraphs = postEl.querySelectorAll('p');
  for (const p of paragraphs) {
    const t = p.innerText.trim();
    if (t.length > bestText.length) bestText = t;
  }

  // If no <p> found, try <span> elements with substantial text
  if (!bestText) {
    const spans = postEl.querySelectorAll('span');
    for (const span of spans) {
      const t = span.innerText.trim();
      // Skip short text (buttons, counts, etc.)
      if (t.length > 50 && t.length > bestText.length) bestText = t;
    }
  }

  return bestText;
}

// ─── Detect post type ───
function detectPostType(postEl) {
  if (postEl.querySelector('video')) return 'video';
  // Check for article links (LinkedIn articles have external link previews)
  const links = postEl.querySelectorAll('a[href*="linkedin.com/pulse"], a[href*="linkedin.com/news"]');
  if (links.length > 0) return 'article';
  // Check for images (skip profile pics and icons by requiring reasonable size)
  const images = postEl.querySelectorAll('img');
  for (const img of images) {
    if (img.naturalWidth > 200 || img.width > 200) return 'image';
  }
  return 'text';
}

// ─── Extract data from a specific post ───
function extractPostData(postEl) {
  const postText = extractPostText(postEl);
  const authorName = extractAuthorName(postEl);
  const postType = detectPostType(postEl);

  // Existing comments (look for contenteditable or comment text areas)
  const comments = [];
  // Comments may not be visible until expanded, so this may return empty
  const commentEls = postEl.querySelectorAll('[aria-label*="comment" i] span, [role="article"] span');
  commentEls.forEach(el => {
    const text = el.innerText.trim();
    if (text && text.length > 10) comments.push(text);
  });

  return { postText, authorName, comments, postType };
}

// ─── Inject HM Comment button on a single post ───
function injectGenieButton(postEl) {
  if (postEl.dataset.genieInjected === 'true') return;
  postEl.dataset.genieInjected = 'true';

  const actionBar = findActionBar(postEl);
  if (!actionBar) {
    // Non-critical: some posts (ads, promoted) don't have action bars
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'genie-btn';
  btn.innerHTML = '<span class="genie-icon">\ud83d\udcac</span><span class="genie-label">HM</span>';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGenieClick(postEl);
  });

  actionBar.appendChild(btn);
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
  chrome.storage.sync.get({ tone: 'default' }, (settings) => {
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
            retryPayload: payload,
            postEl
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
    <button class="genie-close-btn" id="genie-close">\u2715</button>
  `;
  modal.appendChild(header);

  // Tone selector
  const toneBar = document.createElement('div');
  toneBar.className = 'genie-tone-bar';
  toneBar.innerHTML = `
    <span class="genie-tone-label">TONE</span>
    <select class="genie-tone-select" id="genie-tone">
      <option value="default">Default Voice</option>
      <option value="hormozi">Hormozi Style</option>
      <option value="professional">Professional</option>
      <option value="casual">Casual</option>
    </select>
  `;
  modal.appendChild(toneBar);

  // Set current tone
  chrome.storage.sync.get({ tone: 'default' }, (settings) => {
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

  // Escape key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

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
            retryPayload: payload,
            postEl
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

    // Use textContent to prevent XSS from webhook responses
    const errorText = document.createElement('div');
    errorText.className = 'genie-error-text';
    errorText.textContent = state.message;
    errorDiv.appendChild(errorText);

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
                retryPayload: state.retryPayload,
                postEl: state.postEl
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
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
    return;
  }
  const overlay = document.getElementById('genie-overlay');
  if (overlay) overlay.remove();
}

// ─── Insert Comment into LinkedIn ───
async function insertComment(postEl, text) {
  if (!postEl) {
    closeModal();
    return;
  }

  // Step 1: Click LinkedIn's Comment button to expand comment section
  const commentBtn = findCommentButton(postEl);
  if (commentBtn) {
    commentBtn.click();
  }

  // Step 2: Wait for comment box to appear
  const commentBox = await waitForCommentBox(postEl, 4000);

  if (commentBox) {
    commentBox.focus();
    commentBox.innerHTML = '';

    // Try modern InputEvent approach first, fall back to execCommand
    try {
      const inputEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      commentBox.dispatchEvent(inputEvent);

      // Check if it worked (LinkedIn's editor may not respond to beforeinput)
      if (!commentBox.textContent.trim()) {
        // Fallback to execCommand
        document.execCommand('insertText', false, text);
      }
    } catch (e) {
      // Fallback to execCommand
      document.execCommand('insertText', false, text);
    }

    // Dispatch input event for LinkedIn's state tracking
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));

    closeModal();
  } else {
    // Copy to clipboard as last resort
    navigator.clipboard.writeText(text).then(() => {
      updateModal({
        error: true,
        message: 'Could not find the comment box. The comment has been copied to your clipboard. Paste it manually.'
      });
    }).catch(() => {
      updateModal({
        error: true,
        message: 'Could not find the comment box. Try clicking Comment on the post first, then use HM Comment.'
      });
    });
  }
}

// ─── Wait for comment box to appear after clicking Comment ───
function waitForCommentBox(postEl, timeout = 4000) {
  return new Promise((resolve) => {
    const check = () => {
      // Look for contenteditable inside or near the post
      const box = postEl.querySelector('[contenteditable="true"]');
      if (box) return box;

      // LinkedIn may render the comment box outside the listitem,
      // so also check the next sibling or nearby elements
      const nextSibling = postEl.nextElementSibling;
      if (nextSibling) {
        const siblingBox = nextSibling.querySelector('[contenteditable="true"]');
        if (siblingBox) return siblingBox;
      }

      // Fallback: look for any recently-appeared contenteditable near the bottom of the viewport
      const allEditable = document.querySelectorAll('[contenteditable="true"]');
      for (const el of allEditable) {
        // Skip the main post composer at the top
        if (el.closest('[role="main"]') && !el.closest(POST_SELECTOR)) continue;
        if (el.offsetHeight > 0 && el.offsetWidth > 0) return el;
      }

      return null;
    };

    const existing = check();
    if (existing) {
      resolve(existing);
      return;
    }

    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      const el = check();
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
  const observer = new MutationObserver(() => {
    // Debounce: batch DOM changes
    if (observer._pending) return;
    observer._pending = true;
    requestAnimationFrame(() => {
      observer._pending = false;
      const posts = findPostElements();
      posts.forEach(injectGenieButton);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}

// ─── Initialize ───
function init() {
  console.log('HM Comment: Initializing...');

  // Wait for LinkedIn to render the feed
  setTimeout(() => {
    observeFeed();
    console.log('HM Comment: Ready. Found', findPostElements().length, 'posts.');
  }, 1500);

  // Re-scan on URL changes (LinkedIn is a SPA)
  let lastUrl = window.location.href;
  const checkUrl = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('HM Comment: URL changed, re-scanning...');
      setTimeout(() => {
        const posts = findPostElements();
        posts.forEach(injectGenieButton);
      }, 2000);
    }
  };

  // Use popstate for back/forward navigation
  window.addEventListener('popstate', checkUrl);

  // Use a single observer for pushState/replaceState URL changes
  const urlObserver = new MutationObserver(checkUrl);
  urlObserver.observe(document.body, { childList: true, subtree: true });
}

// Start when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
