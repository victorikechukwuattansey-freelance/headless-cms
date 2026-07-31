# AI Memory Vault (OpenCode Edition)

Version: 1.0

Based on the architecture of Jared Rhodenizer's AI Memory Vault, this edition is adapted for **OpenCode**, local execution, and open-source models.

## Goal

Build an AI-operated memory vault that runs entirely on your own computer.

## Core Principles

- The Obsidian vault is the AI's long-term memory.
- Load only the context required for the current task.
- Keep memory structured with indexes, jobs, and daily notes.
- Everything runs locally.

## Recommended Stack

- OpenCode
- Obsidian
- Ollama
- Qwen3 30B (general)
- DeepSeek R1 32B (coding)
- Mistral Small (fast)
- Git
- VS Code
- Node.js

## Folder Layout

```text
Vault/
├── 00 - Inbox
├── 01 - Daily Notes
├── 02 - Projects
├── 03 - Personal
├── 04 - Resources
├── 05 - Archive
├── AGENTS.md
├── VAULT-INDEX.md
└── Active Priorities.md
```

## AGENTS.md

Create an `AGENTS.md` file beside your OpenCode workspace.

Startup sequence:

1. Read AGENTS.md
2. Read VAULT-INDEX.md
3. Read Active Priorities.md
4. Read yesterday's Daily Note
5. Load only the notes needed for the current task.

Rules:

- Never invent facts.
- Never duplicate notes.
- Always update Daily Notes after meaningful work.
- Always update Active Priorities.
- Maintain folder indexes.
- Use YAML frontmatter and Obsidian wikilinks.

## Local Models

| Purpose | Model |
|---------|-------|
| General | Qwen3 30B |
| Coding | DeepSeek R1 32B |
| Fast | Mistral Small |
| Large writing | Llama 3.3 70B (if available) |

## MCP Servers

- Filesystem
- Git
- SQLite
- PostgreSQL
- Context7
- Sequential Thinking
- Playwright
- Puppeteer
- GitHub (optional)
- Brave Search (optional)

## Job System

Each recurring workflow gets one Job note containing:

- Procedure
- Required references
- Quality checklist
- Lessons learned

The AI loads the Job plus linked notes only.

## Daily Notes

One note per day:

- What Got Done
- What's Still in Progress
- Decisions
- Notes Touched
- Profile Updates

## Differences from the Claude edition

- Replace CLAUDE.md with AGENTS.md.
- Replace Claude Code with OpenCode.
- Use Ollama or another local inference engine.
- Store all memory exclusively in Obsidian.
- Avoid vendor-specific instructions.

## Philosophy

The vault is the AI's memory. The model is replaceable; the memory system is not.
