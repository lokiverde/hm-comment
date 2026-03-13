# HM Comment - AI-Powered LinkedIn Comment Generator

[![Deploy Landing Page](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lokiverde/hm-comment&root-directory=landing-page)

## Quick Deploy
- **Landing Page:** Click the button above to deploy to Vercel
- **Chrome Extension:** See `chrome-extension/` folder  
- **Store Assets:** See `chrome-store/` folder

---

A Chrome extension + n8n workflow that generates smart, context-aware LinkedIn comment suggestions. Click the **HM** button on any LinkedIn post and get 3 tailored comment options you can insert with one click.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue) ![n8n](https://img.shields.io/badge/n8n-Workflow-orange) ![AI](https://img.shields.io/badge/AI-OpenRouter-green)

## How It Works

1. Browse your LinkedIn feed as usual
2. Click the **HM** button that appears on each post's action bar (next to Like, Comment, Share)
3. A modal pops up with 3 AI-generated comment suggestions:
   - **Quick**: Short, punchy (3-8 words)
   - **Medium**: Affirms the post's key point with a personal insight (2 sentences max)
   - **Detailed**: Different angle, personal experience, or contrarian take (2-4 sentences)
4. Click any suggestion to auto-insert it into the LinkedIn comment box
5. Switch tones anytime (Default, Hormozi, Professional, Casual)

## What's Included

```
hm-comment-github/
  chrome-extension/       # The Chrome extension (load into Chrome)
    manifest.json
    background.js
    contentscript.js
    styles.css
    popup.html
    popup.js
  n8n-workflow/           # The n8n automation (import into n8n)
    hm-comment-workflow.json
```

---

## Setup Guide

### Prerequisites

- [n8n](https://n8n.io) instance (self-hosted or cloud)
- [OpenRouter](https://openrouter.ai) account with API credits
- Google Chrome browser

### Step 1: Set Up OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai) and create an account
2. Add credits to your account (the workflow uses `claude-haiku-4.5` which is very affordable)
3. Go to **Keys** and create a new API key
4. Keep this key handy for Step 2

### Step 2: Import the n8n Workflow

1. Open your n8n instance
2. Click **Add workflow** (or the `+` button)
3. Click the **three dots menu (...)** in the top right and select **Import from file**
4. Select `n8n-workflow/hm-comment-workflow.json`
5. The workflow will load with these nodes:

```
Webhook -> Prep Data -> Is Default Tone? -> AI Agent (Default Voice) -> Format Response -> Respond to Webhook
                                         -> AI Agent (Other Tones)  ->
```

### Step 3: Add Your OpenRouter Credentials

1. In the imported workflow, double-click the **OpenRouter Chat Model** node
2. Click the **Credential** dropdown and select **Create New Credential**
3. Enter your OpenRouter API key from Step 1
4. Click **Save**
5. Repeat for the **OpenRouter Chat Model1** node (use the same credential)

### Step 4: Activate the Workflow

1. Toggle the workflow to **Active** (top right switch)
2. Note the webhook URL displayed on the **Webhook** node. It will look like:
   ```
   https://your-n8n-instance.com/webhook/hm-comment
   ```
3. Copy this URL. You'll need it for the Chrome extension.

### Step 5: Test the Webhook

Before installing the extension, verify the workflow works. Run this in your terminal:

```bash
curl -X POST https://your-n8n-instance.com/webhook/hm-comment \
  -H "Content-Type: application/json" \
  -d '{
    "postText": "Just launched my first SaaS product after 6 months of building. Revenue is small but growing. The hardest part was not the code, it was the marketing.",
    "comments": [],
    "authorName": "John Doe",
    "postType": "text",
    "tone": "default"
  }'
```

You should get back a JSON response like:

```json
{
  "success": true,
  "data": [
    {"text": "Marketing is the real product.", "type": "short"},
    {"text": "Six months from idea to revenue is solid execution...", "type": "mid"},
    {"text": "The marketing realization hits different when...", "type": "mid"}
  ],
  "error": null
}
```

### Step 6: Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this repo
5. The HM Comment extension icon will appear in your toolbar

### Step 7: Configure the Extension

1. Click the **HM Comment** icon in your Chrome toolbar
2. Set your **Webhook URL** to the URL from Step 4
3. Choose your preferred **Default Tone**
4. Click **Save Settings**

### Step 8: Use It

1. Go to [linkedin.com](https://www.linkedin.com)
2. Scroll through your feed
3. You'll see an **HM** button on each post's action bar
4. Click it, pick a suggestion, done.

---

## Customization

### Change the AI Model

Edit the `model` field in both OpenRouter Chat Model nodes. Some options:

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `anthropic/claude-haiku-4.5` | Fast | Good | Low |
| `anthropic/claude-sonnet-4-20250514` | Medium | Great | Medium |
| `openai/gpt-4o-mini` | Fast | Good | Low |
| `openai/gpt-4o` | Medium | Great | Medium |

### Customize Your Default Voice

Edit the **AI Agent - Default Voice** node's system message. This is where you define your personal tone of voice. The included prompt uses a conversational, confident style. Replace it with your own writing guidelines.

### Add More Tones

1. In the n8n workflow, edit the **AI Agent - Other Tones** node's system message
2. Add a new `When tone is [your-tone]:` section with style guidelines
3. In the Chrome extension's `popup.html`, add a new `<option>` to the tone selector:
   ```html
   <option value="your-tone">Your Tone Name</option>
   ```
4. Also add it to the tone selector in `contentscript.js` (search for `genie-tone` select element)

### Adjust Comment Lengths

Edit the `text` (user prompt) in both AI Agent nodes. The requirements section controls output format:

```
- Comment 1: Short (3-8 words), punchy and impactful
- Comment 2: Medium (2 sentences max), affirms the post's key point...
- Comment 3: Mid-length (2-4 sentences), different angle...
```

---

## Architecture

```
LinkedIn Feed (Chrome)
    |
    v
Content Script (contentscript.js)
    |  Scrapes: post text, author, comments, post type
    |  User selects tone
    v
Background Worker (background.js)
    |  POST request to n8n webhook
    v
n8n Workflow
    |  Webhook -> Prep Data -> Route by Tone -> AI Agent -> Format JSON
    v
OpenRouter API
    |  Claude Haiku generates 3 comments
    v
Chrome Extension
    |  Displays suggestions in modal
    |  Click to auto-insert into LinkedIn comment box
    v
LinkedIn Comment Box (auto-filled)
```

## Webhook API

**POST** `https://your-n8n-instance.com/webhook/hm-comment`

### Request

```json
{
  "postText": "The LinkedIn post text (max 3000 chars)",
  "comments": ["Existing comment 1", "Existing comment 2"],
  "authorName": "Post Author Name",
  "postType": "text|article|image|video|reshare",
  "tone": "default|hormozi|professional|casual"
}
```

### Response

```json
{
  "success": true,
  "data": [
    { "text": "Short comment here", "type": "short" },
    { "text": "Medium comment here...", "type": "mid" },
    { "text": "Longer comment with different angle...", "type": "mid" }
  ],
  "error": null
}
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| HM button doesn't appear | Reload LinkedIn page. Check `chrome://extensions/` for errors. |
| "Request timed out" | Verify your n8n workflow is active and the webhook URL is correct. |
| "Webhook returned 500" | Check n8n execution logs. Usually a missing OpenRouter credential. |
| Comments don't insert | LinkedIn changes their DOM. Click the Comment button manually first, then try HM. |
| Extension not updating | Remove and re-load the unpacked extension, then hard refresh LinkedIn (Cmd+Shift+R). |

## License

MIT

## Credits

Built with [n8n](https://n8n.io), [OpenRouter](https://openrouter.ai), and Claude AI.
