/**
 * HM Comment - Background Service Worker
 * Handles API calls to n8n webhook and manages settings.
 * Using a service worker avoids CORS issues with n8n.
 */

// IMPORTANT: Update this to YOUR n8n webhook URL after importing the workflow
const DEFAULT_WEBHOOK_URL = 'https://your-n8n-instance.com/webhook/hm-comment';
const REQUEST_TIMEOUT_MS = 30000;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'generateComments') {
    handleGenerateComments(message.payload)
      .then(sendResponse)
      .catch(err => {
        console.error('HM Comment background error:', err);
        sendResponse({
          success: false,
          data: null,
          error: err.message || 'Unknown error occurred'
        });
      });
    // Return true to indicate async response
    return true;
  }
});

async function handleGenerateComments(payload) {
  // Get webhook URL from settings
  const settings = await chrome.storage.sync.get({
    webhookUrl: DEFAULT_WEBHOOK_URL
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Webhook returned ${response.status}${errorText ? ': ' + errorText.substring(0, 200) : ''}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let result;

    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // Handle plain text response
      const text = await response.text();
      result = parseTextResponse(text);
    }

    // Normalize response format
    if (result.success !== undefined) {
      return result;
    } else if (result.data) {
      return { success: true, data: result.data, error: null };
    } else if (Array.isArray(result)) {
      return { success: true, data: result, error: null };
    } else if (result.comments) {
      return { success: true, data: result.comments, error: null };
    } else {
      // Try numbered format: {"1": "...", "2": "...", "3": "..."}
      const numbered = extractNumberedResponses(result);
      if (numbered.length > 0) {
        return { success: true, data: numbered, error: null };
      }
      throw new Error('Unexpected response format from webhook');
    }
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        data: null,
        error: 'Request timed out. Check that your n8n webhook is active.'
      };
    }

    return {
      success: false,
      data: null,
      error: err.message || 'Failed to reach webhook'
    };
  }
}

// Parse newline-separated text response
function parseTextResponse(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    throw new Error('Received empty response from webhook');
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    // Fall through to line-based parsing
  }

  return {
    success: true,
    data: lines.map((line, i) => ({
      text: line.trim(),
      type: i === 0 ? 'short' : 'mid'
    })),
    error: null
  };
}

// Extract {"1": "...", "2": "...", "3": "..."} format
function extractNumberedResponses(obj) {
  const results = [];
  for (let i = 1; i <= 10; i++) {
    const key = String(i);
    if (obj[key] && typeof obj[key] === 'string') {
      results.push({
        text: obj[key],
        type: i === 1 ? 'short' : 'mid'
      });
    }
  }
  return results;
}

// Extension installed/updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('HM Comment installed/updated:', details.reason);

  if (details.reason === 'install') {
    chrome.storage.sync.set({
      webhookUrl: DEFAULT_WEBHOOK_URL,
      tone: 'default'
    });
  }
});
