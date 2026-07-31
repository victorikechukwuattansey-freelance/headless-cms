# jarvis-demo

**OpenCode workspace for the Jarvis AI agent.** Links to an Obsidian vault for long-term memory. Not a software project — no build, test, or lint pipeline.

## Instruction Chain (loaded every session)

`opencode.json` loads these in order:

1. `AGENTS.md` (this file) — repo guide, constitution
2. `C:\Users\1040 G8\Documents\Brain\VAULT-INDEX.md` — vault map, profile, rules
3. `C:\Users\1040 G8\Documents\Brain\_system\JARVIS-OPERATING-SYSTEM.md` — operating manual, startup routine, agent abilities
4. `C:\Users\1040 G8\Documents\Brain\Active Priorities.md` — current open work

The Obsidian vault is at `C:\Users\1040 G8\Documents\Brain`. It is the single source of truth for memory, priorities, and daily logs.

## Project Structure

| Path | Purpose |
|---|---|
| `opencode.json` | OpenCode config: model, instructions, vault reference |
| `.opencode/commands/tts.md` | OpenCode command: text-to-speech |
| `.opencode/commands/voice.md` | OpenCode command: voice assistant |
| `scripts/tts.ps1` | PowerShell TTS via `System.Speech` |
| `scripts/jarvis-voice.ps1` | Voice-activated assistant (whisper STT + opencode + TTS) |
| `scripts/setup-voice.ps1` | One-command dependency installer (ffmpeg, whisper.cpp) |
| `batch-social-processor.mjs` | Batch image processor — convert masters to platform-ready social ad PNGs |
| `scripts/render-flyers.mjs` | HTML→A4 PNG render pipeline via Playwright |
| `scripts/generate-mockups.mjs` | Device mockup compositor (sharp + SVG) |
| `scripts/generate-product-images.mjs` | Product listing image generator (covers, previews) |
| `African-Real-Estate-Agent-Growth-Kit-v1.0.zip` | Product ZIP (13.76 MB) — 9 modules, 111 files |
| `African-Real-Estate-Affiliate-Promo-Pack.zip` | Affiliate promo pack — mockups, ad scripts, WhatsApp scripts, email swipes, FAQ sheet |
| `package.json` | Dependencies and scripts (`npm run build:ads`)
| `MEMORY.md` | Redirects memory to vault (legacy, not loaded by OpenCode) |
| `ai-memory-vault-opencode.md` | Reference/tutorial doc (not loaded as instructions) |
| `.obsidian/` | Obsidian workspace config (app, appearance, plugins) |
| `_open-canva/` | OpenCanva design workspace — React-component template designs with live canvas preview |
| `_mcp-affinity-designer/` | Affinity Designer MCP server (built, blocked — Affinity Designer not installed) |

## Available Commands

### TTS

Generate speech audio from text:

```powershell
& .\scripts\tts.ps1 -Text "hello" -OutFile "output.wav" [-Voice "Microsoft Zira Desktop"]
```

Voices: `Microsoft Zira Desktop` (en-US, default), `Microsoft Hazel Desktop` (en-GB).

Invokable via OpenCode command as well (see `.opencode/commands/tts.md`).

### Voice Assistant

Full voice-activated assistant (push-to-talk + whisper STT + opencode AI + TTS):

```powershell
.\scripts\setup-voice.ps1          # one-time dependency install
.\scripts\jarvis-voice.ps1         # launch assistant (F2 to talk, Esc to quit)
```

Dependencies: `ffmpeg`, `whisper-cli.exe` + `ggml-tiny.bin` model.

## Repo State

- **No commits yet.** All files are untracked. Initialize with `git add . && git commit -m "initial scaffold"` when ready.
- `package.json` includes `sharp`, `commander`, `glob` for the social ad batch processor.

## Available Agent Skills

The system prompt loads these skills for specialized tasks:

| Skill | Trigger |
|---|---|
| `code-review` | Code/PR quality review using CodeRabbit |
| `customize-opencode` | Editing OpenCode config (opencode.json, .opencode/) |
| `find-skills` | Discovering new skills from the ecosystem |
| `canva-authoring` | Writing/editing OpenCanva template designs — file contract, artboard model, primitives, coordinate system |
| `create-design` | Scaffolding a new OpenCanva design under `_open-canva/designs/<id>/` |
| `create-theme` | Creating a new custom color palette/theme for OpenCanva |
| `apply-comments` | Processing inspector markers/comments on OpenCanva designs |
| `current-design` | Resolving "this design" to a concrete `<id>` in the open-canva project |
| `svg-illustration` | Hand-authoring inline SVG illustrations for OpenCanva templates |

### Finding & Installing New Skills

The Skills CLI (`npx skills`) searches and installs community skills from https://skills.sh/:

```powershell
npx skills find <query>    # search for skills
npx skills add <package>   # install a skill (-g for global, -y skip prompts)
npx skills check           # check for updates
npx skills update          # update all installed skills
```

Browse the leaderboard at https://skills.sh/ for popular skills by category (React, testing, DevOps, etc.).

Installed skills go to `~/.claude/skills/` (or the configured skills directory).

### OpenCanva Template Design

Design templates as React components in `_open-canva/designs/<id>/index.tsx`. Preview with `npm run dev` in `_open-canva/`, open at `/d/<id>`. Export to PNG/SVG/PDF via the built-in export panel. Before authoring, load the `canva-authoring` skill for the file contract and object model.

## Available Commands

### Social Media Posting

Post ads as **drafts for review** before publishing. See `.opencode/commands/social.md`.

Powered by PostEverywhere MCP. Requires `POSTEVERYWHERE_API_KEY` env var.

## Session Rules

- If a task runs for more than ten minutes, break the remaining work into smaller subtasks and ask for permission before proceeding. Always provide recommended options before starting subtasks.

## Purpose

This project uses autonomous AI agents that coordinate multiple MCP servers and APIs to research, design, build, and validate software.

The AI should automatically determine which tools are required and execute them in the correct order.

---

# Connected Services

## Figma MCP

Purpose:
Source of truth for all UI and UX.

Capabilities

- Read files
- Read frames
- Read components
- Read typography
- Read colors
- Read spacing
- Read variables
- Read Auto Layout
- Export assets

Rules

- Never guess visual properties.
- Always inspect Figma before writing UI code.
- Preserve spacing, colors, typography, and hierarchy.

---

## Oxylabs AI

Purpose:
Live web intelligence.

Capabilities

- Google Search
- Website Extraction
- Competitor Analysis
- Product Research
- Pricing
- Company Information
- SEO
- News

Rules

- Never fabricate search results.
- Clearly separate verified information from assumptions.
- Use Oxylabs whenever current information is required.

---

## OpenCode

Responsible for

- Planning
- Coding
- Testing
- Debugging
- Refactoring
- Documentation
- Git operations

---

# Execution Order

When multiple tools are needed

1. Read Figma
2. Research with Oxylabs
3. Implement using OpenCode
4. Test
5. Report

---

# Shared Context

Maintain throughout the session

- Active Figma file
- Selected frame
- Design tokens
- Research findings
- Existing project structure
- User preferences
- Generated components

Reuse this context until replaced.

---

# Error Handling

If Figma is unavailable

- Continue with project files
- Explain the limitation

If Oxylabs is unavailable

- Use internal knowledge
- State that live verification could not be completed

Never present assumptions as verified facts.

---

# Decision Priority

1. User instructions
2. Project code
3. Figma
4. Oxylabs
5. Internal knowledge

Always prefer higher-priority sources.

## Constraints

- Do not modify `.opencode/` unless configuring OpenCode itself.
- Never publish social media content without explicit user approval — always use draft mode.
- Do not move the vault location without updating `opencode.json` references.
- The `MEMORY.md` and `ai-memory-vault-opencode.md` files are reference material; treat as read-only unless updating the vault architecture.
