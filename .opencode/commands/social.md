---
description: Draft and publish social media posts across platforms (PostEverywhere MCP).
---

## Social Media Posting

Powered by PostEverywhere MCP. All posts should be created as **drafts first** for user review.

### Important rules

- **Always create drafts first** — never publish without explicit user confirmation
- Use `draft: true` on every post creation call
- Confirm the post content, platforms, and schedule with the user before scheduling/publishing

### Example workflow

```
1. Ask user: what content, which platforms, when to post
2. Create drafts on each platform
3. Show the drafts to the user for review
4. On user approval, publish them
```

Requires `POSTEVERYWHERE_API_KEY` environment variable to be set.
