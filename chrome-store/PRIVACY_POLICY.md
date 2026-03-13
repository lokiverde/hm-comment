# Privacy Policy for HM Comment Chrome Extension

**Last Updated: March 13, 2026**

## Overview

HM Comment ("the Extension") is a browser extension that helps users generate AI-powered comments for LinkedIn posts. This privacy policy explains how the Extension handles your data.

## Data Collection

### What We Collect
The Extension collects and processes the following data **locally on your device only**:

- **LinkedIn Post Content**: When you click the "HM" button, the text content of that specific LinkedIn post is sent to your configured webhook URL to generate comment suggestions.
- **User Preferences**: Your webhook URL and tone preferences are stored locally in your browser using Chrome's storage API.

### What We Do NOT Collect
- We do not collect personal information
- We do not track your browsing history
- We do not store LinkedIn post content on any server
- We do not use analytics or tracking pixels
- We do not share any data with third parties
- We do not access your LinkedIn credentials

## Data Processing

When you click the "HM" button:
1. The Extension reads the text content of that specific post
2. The content is sent to YOUR configured webhook URL (not ours)
3. The webhook returns AI-generated comment suggestions
4. The suggestions are displayed to you
5. No data is retained after you close the popup

**You control where your data goes.** The webhook URL is configured by you and can point to your own server, n8n instance, or any AI service you choose.

## Data Storage

All user preferences (webhook URL, tone settings) are stored locally in your browser using Chrome's `storage.sync` API. This data:
- Stays on your device
- Syncs across your Chrome browsers if you're signed in to Chrome
- Can be deleted by uninstalling the extension
- Is never transmitted to us

## Third-Party Services

The Extension itself does not use any third-party services. However, your configured webhook may connect to third-party AI services (such as OpenAI, Anthropic, or others). The privacy practices of those services are governed by their respective privacy policies.

## LinkedIn

This Extension interacts with LinkedIn.com to add functionality to the user interface. We do not:
- Access your LinkedIn account credentials
- Post comments automatically (you always click to post)
- Scrape or store LinkedIn data
- Violate LinkedIn's Terms of Service

## Children's Privacy

This Extension is not intended for use by children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. The "Last Updated" date at the top of this policy indicates when it was last revised.

## Contact

If you have questions about this privacy policy, please contact:

**Harcourts Hunter Mason Realty**
1617 S. Pacific Coast Highway, Suite D
Redondo Beach, CA 90277
Email: tony@huntermason.com

## Your Rights

You can:
- View your stored preferences via Chrome's extension settings
- Delete all stored data by uninstalling the extension
- Choose not to use the extension at any time

---

*This Extension is provided by Harcourts Hunter Mason Realty and is not affiliated with or endorsed by LinkedIn Corporation.*
