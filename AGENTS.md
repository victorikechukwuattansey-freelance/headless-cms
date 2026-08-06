# jarvis-demo

**OpenCode workspace for the Jarvis AI agent.** Links to an Obsidian vault for long-term memory. The root is an agent workspace with no pipeline of its own; contained software projects (e.g. `ai-workflow-dashboard`, `saas-boilerplate`, `kaya-renovations`, `_open-canva`) have their own tooling.

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
| `package.json` | Dependencies and root scripts (`build:ads`, `build:site`, `build:blaise`)
| `MEMORY.md` | Redirects memory to vault (legacy, not loaded by OpenCode) |
| `ai-memory-vault-opencode.md` | Reference/tutorial doc (not loaded as instructions) |
| `.obsidian/` | Obsidian workspace config (app, appearance, plugins) |
| `_open-canva/` | OpenCanva design workspace — React-component template designs with live canvas preview |
| `_mcp-affinity-designer/` | Affinity Designer MCP server (configured in opencode.json; requires the Affinity Designer app to be running) |
| `ADR/` | Architecture Decision Record registry — index + template (ADRs themselves live in owning projects, e.g. `saas-boilerplate/docs/adr/`) |
| `docs/ai/` | Agent behavior notes — deltas too small for AGENTS.md or vault `_system/` manuals |
| `docs/onboarding/` | Workspace boot guide — instruction chain, startup routine, commands |
| `docs/decisions/` | Running decision log — informal history; graduates to ADR when formalized |
| `saas-boilerplate/` | SaaS boilerplate project (Turborepo + pnpm) — own docs, ADRs, apps, packages |
| `ai-workflow-dashboard/` | AI workflow dashboard monorepo (NestJS API + Next.js web + Prisma) |
| `kaya-renovations/` | Kaya Home Renovations client site (static Tailwind, built via `build:site`) |
| `blaise-crest-enterprises/` | Blaise Crest Enterprises client site (static Tailwind, built via `build:blaise`) |
| `mc-danfo/` | MC Danfo multipage site (Next.js App Router) |
| `mc-danfo-old/` | MC Danfo pre-rebuild archive (source-only backup) |
| `social-media-os/` | Social media OS monorepo (apps, packages, docker, k8s) |
| `landing-pages/` | Landing page collection |
| `lcos/` | LCOS project |
| `.agents/` | Workspace agent skills (loaded by the system prompt) |

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

### Social Media Posting

Post ads as **drafts for review** before publishing. See `.opencode/commands/social.md`.

Powered by PostEverywhere MCP. Requires `POSTEVERYWHERE_API_KEY` env var.

## Repo State

- Git history exists: `a9aa112` initial scaffold, `8628111` Prisma client fix, `d08c70b` Kaya Home Renovations site. Working tree has in-progress changes not yet committed.
- Root `package.json` scripts: `build:ads` (batch social processor), `build:site` (kaya-renovations), `build:blaise` (blaise-crest-enterprises).

## Available Agent Skills

The system prompt auto-loads the full skill set each session (workspace `.agents/skills/` plus installed plugin skills). Highlights relevant to this workspace:

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
| `react-best-practices` | React quality checklist after editing TSX components |
| `nextjs` | Next.js App Router guidance — routing, RSC, data fetching |
| `supabase` | Any task involving Supabase — auth, database, storage |
| `tailwind-css` | Tailwind v4 styling and configuration |
| `hyperframes` | Video and motion-graphic creation, rendering, captions |
| `web-research` | Cited web research reports |

### Finding & Installing New Skills

The Skills CLI (`npx skills`) searches and installs community skills from https://skills.sh/:

```powershell
npx skills find <query>    # search for skills
npx skills add <package>   # install a skill (-g for global, -y skip prompts)
npx skills check           # check for updates
npx skills update          # update all installed skills
```

Browse the leaderboard at https://skills.sh/ for popular skills by category (React, testing, DevOps, etc.).

This workspace's skills live in `.agents/skills/`; user-level plugin skills live under `~/.config/opencode/`. The Skills CLI installs to the configured skills directory.

### OpenCanva Template Design

Design templates as React components in `_open-canva/designs/<id>/index.tsx`. Preview with `npm run dev` in `_open-canva/`, open at `/d/<id>`. Export to PNG/SVG/PDF via the built-in export panel. Before authoring, load the `canva-authoring` skill for the file contract and object model.

## Session Rules

- If a task runs for more than ten minutes, break the remaining work into smaller subtasks and ask for permission before proceeding. Always provide recommended options before starting subtasks.

## Purpose

This project uses autonomous AI agents that coordinate multiple MCP servers and APIs to research, design, build, and validate software.

The AI should automatically determine which tools are required and execute them in the correct order.

---

## Connected Services

### Figma MCP

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

### Oxylabs AI

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

### OpenCode

Responsible for

- Planning
- Coding
- Testing
- Debugging
- Refactoring
- Documentation
- Git operations

---

## Execution Order

When multiple tools are needed

1. Read Figma
2. Research with Oxylabs
3. Implement using OpenCode
4. Test
5. Report

---

## Shared Context

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

## Error Handling

If Figma is unavailable

- Continue with project files
- Explain the limitation

If Oxylabs is unavailable

- Use internal knowledge
- State that live verification could not be completed

Never present assumptions as verified facts.

---

## Decision Priority

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

---

## Project Instructions

This project uses:

- React
- Next.js App Router
- TypeScript
- Tailwind CSS

Applies to the contained web projects (e.g. `_open-canva`, `mc-danfo`, `saas-boilerplate`); the workspace root itself has no code pipeline.

When asked to optimize performance:

Always use the `vercel-react-best-practices` skill (React/Next.js performance optimization).

Your workflow must be:

1. Inspect before editing.
2. Explain findings.
3. Rank issues by severity.
4. Recommend fixes.
5. Show exact code changes.
6. Explain trade-offs.
7. Explain how improvements should be verified.

Never:

- guess metrics
- fabricate Lighthouse results
- make silent architecture changes
- introduce unnecessary dependencies
- rewrite the project without justification

If information is missing, ask for clarification before making changes.

Always prioritize maintainability alongside performance.
