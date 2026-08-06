# docs/onboarding — Booting This Workspace

## Context Loaded at Session Start (instruction chain)

`opencode.json` loads in order:

1. `AGENTS.md` — constitution
2. `Brain/VAULT-INDEX.md` — vault map, profile, rules
3. `Brain/_system/JARVIS-OPERATING-SYSTEM.md` — operating manual, startup routine
4. `Brain/Active Priorities.md` — current open work

## Startup Routine (from JARVIS-OPERATING-SYSTEM.md)

1. Read AGENTS.md
2. Read Vault Index
3. Read Operating System manual
4. Read Active Priorities
5. Read latest Daily Note
6. Read relevant Project files
7. Produce context summary
8. Wait for instructions — no work begins until context is loaded

## Useful Commands

| Command | Purpose |
|---|---|
| `& .\scripts\tts.ps1 -Text "..." -OutFile out.wav` | Text-to-speech |
| `.\scripts\setup-voice.ps1` | Voice assistant dependency install |
| `.\scripts\jarvis-voice.ps1` | Voice assistant (F2 talk, Esc quit) |
| `npm run build:ads` | Social ad batch processing |
| Social posting | `.opencode/commands/social.md` (draft mode only) |

## Key Locations

| Path | Purpose |
|---|---|
| `saas-boilerplate/` | SaaS boilerplate project (Turborepo + pnpm) |
| `docs/` | Product/design docs, specs, agent notes |
| `ADR/` | Architecture decision registry |
| `Brain/` | Obsidian vault — single source of truth for memory |
| `_open-canva/` | OpenCanva design workspace |
