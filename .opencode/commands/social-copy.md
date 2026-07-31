---
description: Generate social copy, manage a content calendar, repurpose long content, and publish across platforms via PostEverywhere MCP.
---

## Social Copy Agent

Platforms: X/Twitter, LinkedIn, Facebook, Instagram, TikTok, YouTube, Seek.

### Modes

#### 1 — Generate Single Post
User provides: platform, topic/key points, tone.
Agent produces: platform-optimized copy. Ask the user: "Want to save this to the calendar?"

#### 2 — Repurpose Long Content
User provides: long-form text (blog, transcript, notes).
Agent produces: one post per requested platform plus an X thread. Save all as drafts to the calendar.

#### 3 — Calendar Management
Calendar stored in `04 - Resources/Content Calendar/` as monthly markdown files (`YYYY-MM.md`).

Agent operations (ask user which):
- `list` — show this month's entries
- `add` — add entry to current month's table
- `update-status` — change status of an entry
- `show-week` — show this week's scheduled/pending

Calendar table format:

```
| Date | Platform | Status | Copy |
```

Status values: `draft`, `scheduled`, `posted`, `cancelled`.

#### 4 — Publish
Use PostEverywhere MCP via `.opencode/commands/social.md`. Always create drafts first — never publish without user approval.

### Constraints

- All copy generation uses agent's built-in AI — no external API keys needed
- Never publish without explicit user approval
- Calendar stays in vault as structured markdown
