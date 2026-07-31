# Social Copy Agent — OpenCode Workflow

## Overview

An agent-driven social media content workflow — generate copy, manage a calendar, repurpose long content into platform variants, and publish via PostEverywhere MCP. Runs entirely within OpenCode's AI (no standalone app, no API keys needed for generation).

## Platforms

X/Twitter, LinkedIn, Facebook, Instagram, TikTok, YouTube, Seek.

## Architecture

```
.opencode/commands/social-copy.md          # command entry point (user types "social-copy")
04 - Resources/Content Calendar/           # vault-backed calendar directory
04 - Resources/Content Calendar/Template.md # entry template
```

The agent executes all workflow steps — copy generation, calendar CRUD, repurposing, and publishing coordination.

## Workflow

### 1. Generate — Single Post

User provides: platform, topic/key points, desired tone.
Agent produces: platform-optimized copy string with length and style matching the platform's conventions (e.g., X 280-char, LinkedIn professional tone, TikTok/IG short hooks).

### 2. Generate — Repurpose Long Content

User provides: long-form text (blog, transcript, notes).
Agent produces: one post per platform variant plus an X/Twitter thread, all saved to the calendar as drafts.

### 3. Calendar Management

Stored in the vault under `04 - Resources/Content Calendar/` as monthly markdown files.

Each file: `YYYY-MM.md` (e.g., `2026-07.md`).

Format:

```markdown
# 2026-07 Content Calendar

| Date | Platform | Status | Copy |
|------|----------|--------|------|
```

Status values: `draft`, `scheduled`, `posted`, `cancelled`.

Agent commands: `list`, `add`, `update-status`, `show-week`.

### 4. Publish

Via PostEverywhere MCP (existing `.opencode/commands/social.md` pattern).

Always creates drafts for user review. No auto-publishing.

## File Locations

| File | Purpose |
|------|---------|
| `.opencode/commands/social-copy.md` | Command definition and workflow instructions |
| `04 - Resources/Content Calendar/` | Calendar directory |
| `04 - Resources/Content Calendar/Template.md` | Entry template |

## Dependencies

- PostEverywhere MCP (for publishing) with `POSTEVERYWHERE_API_KEY` env var
- No other dependencies — copy generation uses OpenCode's built-in AI

## Constraints

- Never publish without user approval — always draft mode
- Calendar stays in vault as structured markdown
- All generation is agent-native (no external API calls for copy)
