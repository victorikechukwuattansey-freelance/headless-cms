# WLE Lead Manager — Local Web App

## Overview

A single-file HTML application for the WhatsApp Lead Engine (WLE) that replaces the manual copy-paste workflow. Paste WhatsApp chat text → auto-extract lead info → score → track through pipeline. All data stored in browser localStorage with CSV export.

## Input & Data Model

A lead record contains:

| Field | Type | Source |
|---|---|---|
| id | UUID | Auto-generated |
| createdAt | ISO timestamp | Auto-generated |
| name | string | From extraction or manual entry |
| phone | string | From extraction or manual entry |
| requirement | string | From extraction or manual entry |
| budgetFit | \"High\" | \"Medium\" | \"Low\" | Manual or AI suggestion |
| urgency | \"Hot\" | \"Warm\" | \"Cold\" | Manual or AI suggestion |
| score | number 0-100 | Auto-calculated from budgetFit + urgency |
| status | \"New\" | \"Contacted\" | \"Quote Sent\" | \"Paid\" | \"Lost\" | Manual |
| nextAction | string | From extraction or manual entry |
| notes | string | Manual |
| sourceChat | string | Raw pasted WhatsApp text (optional) |

## Architecture

Single file: wle.html

`
wle.html
├── HTML — App layout, views, forms, pipeline board
├── CSS — Inline styles, responsive grid, score heatmap colors
└── JS — App logic: router, storage, triage engine, scoring
`

### Views (SPA with hash routing)

1. **Dashboard** (\#dashboard\) — Kanban board with 5 columns (New / Contacted / Quote Sent / Paid / Lost). Each card shows name, score (colored), requirement, and created date. Drag or click to change status.

2. **Add Lead** (\#add\) — Two modes:
   - **Quick Entry:** Form fields for name, phone, requirement, budget fit (dropdown), urgency (dropdown), notes. Score auto-calculates.
   - **AI Extraction:** Paste WhatsApp chat into textarea, click \"Analyze\". Built-in keyword extractor parses common patterns (name after \"Name:\", phone after \"Phone:\" or Nigerian patterns, requirement keywords like \"inverter\", \"solar\", \"generator\"). Optional API call if user provides an API key.

3. **Lead Detail** (\#detail?id=X\) — Full lead record. Editable fields. Status dropdown. Delete button. Notes history.

### Scoring Engine

Formula (mirrors spreadsheet):

`
score = (
  SWITCH(budgetFit, \"High\", 50, \"Medium\", 30, \"Low\", 10) +
  SWITCH(urgency, \"Hot\", 50, \"Warm\", 30, \"Cold\", 10)
)
`

Score rendered with color scale: Red (20) → Yellow (60) → Green (100).

### Built-in Triage Extractor

Regex-based keyword extraction for common WhatsApp lead patterns:

- **Name:** Look for \Name:\, \I am\, \My name is\, or take first line of chat
- **Phone:** Nigerian numbers (\\+234, 080, 070, 090 prefixes)
- **Requirement:** Keywords like inverter, solar, generator, battery, panel, installation, quote, price
- **Budget Fit:** \"How much\" = Medium, \"Cheapest\" / \"Discount\" = Low, \"I need\" + price = High
- **Urgency:** \"Today\" / \"Now\" / \"Emergency\" = Hot, \"This week\" = Warm, \"Just checking\" = Cold

### AI Integration (optional)

If user provides an API key (OpenAI / Anthropic) in settings, the \"Analyze\" button sends the chat text to the AI with the triage prompt from \WLE Triage Prompt.md\ and fills in the extracted fields automatically.

Settings stored in localStorage. API key never sent anywhere except directly to the chosen API.

### Pipeline Management

- Change lead status via dropdown in lead detail or click-to-move on Kanban
- Dashboard shows lead counts per column
- Filter: Search by name, requirement, or phone
- Sort: By score (descending) or created date

### Export

- **CSV export** — Downloads all leads as CSV matching the Google Sheet template columns
- **JSON export** — Raw data backup

## Dependencies

None. Single HTML file. No build step. No server. Opens in any modern browser (Chrome, Edge, Firefox).

## File Location

\C:\\Users\\1040 G8\\Documents\\jarvis-demo\\wle.html\

## Future Considerations

- Google Sheets sync (push/pull from the existing template)
- WhatsApp API integration (real-time lead capture)
- Multi-user (Electron wrapper + file sync)
- Mobile-optimized view
