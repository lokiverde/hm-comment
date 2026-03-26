/**
 * HM Comment - Popup Settings
 * Manages webhook URL and default tone preferences.
 */

// IMPORTANT: Update this to YOUR n8n webhook URL after importing the workflow
const DEFAULT_WEBHOOK_URL = 'https://your-n8n-instance.com/webhook/hm-comment';

const toneSelect = document.getElementById('tone');
const webhookInput = document.getElementById('webhookUrl');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

// Load saved settings
chrome.storage.sync.get({
  tone: 'default',
  webhookUrl: DEFAULT_WEBHOOK_URL
}, (settings) => {
  toneSelect.value = settings.tone;
  webhookInput.value = settings.webhookUrl;
});

// Save settings
saveBtn.addEventListener('click', () => {
  const tone = toneSelect.value;
  const webhookUrl = webhookInput.value.trim() || DEFAULT_WEBHOOK_URL;

  chrome.storage.sync.set({ tone, webhookUrl }, () => {
    statusEl.textContent = 'Settings saved!';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });
});
