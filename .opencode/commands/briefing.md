---
description: Generate or refresh today's Daily Briefing in the Obsidian vault, following the JARVIS Operating System.
---

Write today's **Daily Briefing** into the vault daily note, following JARVIS-OPERATING-SYSTEM.md and the established vault format.

## Procedure

1. Read today's note: `C:\Users\1040 G8\Documents\Brain\01 - Daily Notes\YYYY-MM-DD.md` (today's date).
2. Read `C:\Users\1040 G8\Documents\Brain\Active Priorities.md` and yesterday's note (or the latest note before today) for carry-over items.
3. Read today's session files: every `daily-note-YYYY-MM-DD-N.md` in `C:\Users\1040 G8\Documents\Brain\01 - Daily Notes\` — each holds one session's work and its `## Auto Log` footprints; synthesize from them, do not copy verbatim.
4. Produce a briefing with these sections: **Objectives** (from Active Priorities), **Completed Work** (synthesized from the daily-note session files / any existing session sections), **Pending / Blockers**, **Observations**.

## Formatting rules

- Use the header `## Daily Briefing` followed by a line `*Generated <current local HH:MM> by scheduled brief*`.
- If today's note already contains a `## Daily Briefing` section, REPLACE only that section's content (update the generation time); append nothing below it.
- If it does not exist, append the section at the end of the file.
- NEVER modify, delete, or reorder the `## Daily Notes` index, the daily-note session files, other sections, other days' notes, or anything under `_system/`.
- Preserve existing markdown and the template footer if present.
- Keep the briefing under ~30 lines.

## Report

End your response with exactly three lines:

- File written: `<exact absolute path>`
- Sections: <list>
- Summary: <3-line summary of the day's state>