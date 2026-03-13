# Chrome Web Store Submission Checklist

## Before You Start
- [ ] Register at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [ ] Pay $5 one-time registration fee
- [ ] Have a Google account ready

## Required Assets

### Icons
- [ ] **128x128 PNG** — Store listing icon
- [ ] **48x48 PNG** — Extension management page
- [ ] **16x16 PNG** — Browser toolbar (if needed)

**Action:** Create icons with "HM" in a speech bubble design. Can use Canva, Figma, or AI image generator.

### Screenshots (at least 1, up to 5)
- [ ] **1280x800** or **640x400** PNG/JPEG
- [ ] Screenshot 1: LinkedIn feed with HM button visible
- [ ] Screenshot 2: Comment options popup
- [ ] Screenshot 3: Settings/tone selector
- [ ] Screenshot 4: Before/after comparison (optional)

**Action:** Install extension locally, take screenshots on LinkedIn

### Privacy Policy
- [ ] Host PRIVACY_POLICY.md as a webpage
- [ ] Options:
  - Add page to huntermason.com/hm-comment-privacy
  - Use GitHub Pages
  - Use Notion public page
  - Use any static hosting

## Extension Package
- [ ] Zip the `chrome-extension` folder contents (not the folder itself)
- [ ] Ensure manifest.json is at the root of the zip
- [ ] Test the zip by loading unpacked in Chrome first

```bash
cd /tmp/hm-comment/chrome-extension
zip -r ../hm-comment-v2.1.zip .
```

## Store Listing Form

### Basic Info
- **Name:** HM Comment - AI LinkedIn Comment Generator
- **Summary:** Generate professional AI-powered LinkedIn comments instantly. Multiple tones. One click. Boost your engagement 10x.
- **Category:** Productivity
- **Language:** English

### Detailed Description
See STORE_LISTING.md — copy the "Detailed Description" section

### Permissions Justification
When prompted, explain each permission:

**activeTab:** "Required to detect when user is on LinkedIn and inject the comment button interface."

**scripting:** "Required to inject the HM button into LinkedIn post elements and handle user interactions."

**storage:** "Required to save user preferences (webhook URL, default tone) locally in the browser."

**host_permissions (linkedin.com):** "Required to add the comment generation button to LinkedIn posts. The extension only activates on LinkedIn pages."

## Submission Steps

1. Go to [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload your .zip file
4. Fill in store listing details
5. Upload screenshots and icons
6. Add privacy policy URL
7. Fill in permissions justifications
8. Set visibility (Public, Unlisted, or Private)
9. Submit for review

## Post-Submission

- Review typically takes 1-3 business days
- Simple extensions usually pass quickly
- You'll get email notification when approved
- Once approved, updates review faster

## Monetization Setup (Phase 2)

After approval, consider:
1. Add settings page with license key field
2. Create Stripe checkout for license keys
3. Use n8n workflow to validate keys
4. Free tier: 10 comments/day
5. Pro tier: Unlimited + custom tones

---

**Estimated Time to Complete:** 2-3 hours (mostly screenshots and icon creation)
