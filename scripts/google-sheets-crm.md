# Google Sheets CRM — Setup Guide

## Quick Start (2 minutes)

1. Go to **sheets.new** in your browser
2. Copy-paste the setup below

---

## Headers (Row 1)

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Date | Lead Name | Phone Number | Requirement | Budget Fit | Urgency | Lead Score | Status | Next Action |

---

## Lead Score Formula

**Paste into G2:**

```
=IF(AND(E2<>"",F2<>""),
  IF(E2="High",40,IF(E2="Medium",20,IF(E2="Low",0,0)))
  + IF(F2="Hot",60,IF(F2="Warm",30,IF(F2="Cold",0,0))),
  "")
```

**Then drag G2 down to G100** (or however many rows you need).

---

## Data Validation (Dropdowns)

### Budget Fit — Column E
1. Select E2:E100
2. Data → Data validation → Add rule
3. Criteria: **Dropdown** → enter: `High, Medium, Low`
4. Save

### Urgency — Column F
1. Select F2:F100
2. Data → Data validation → Add rule
3. Criteria: **Dropdown** → enter: `Hot, Warm, Cold`
4. Save

### Status — Column H
1. Select H2:H100
2. Data → Data validation → Add rule
3. Criteria: **Dropdown** → enter: `New, Contacted, Quote Sent, Paid, Lost`
4. Save

---

## Conditional Formatting

### Budget Fit (Column E)
| Rule | Apply to range | Format cells if | Value | Style |
|---|---|---|---|---|
| 1 | E2:E | Text contains | High | Green fill, bold |
| 2 | E2:E | Text contains | Medium | Yellow/amber fill |
| 3 | E2:E | Text contains | Low | Red fill |

### Urgency (Column F)
| Rule | Apply to range | Format cells if | Value | Style |
|---|---|---|---|---|
| 1 | F2:F | Text contains | Hot | Red fill, bold, white text |
| 2 | F2:F | Text contains | Warm | Yellow/amber fill |
| 3 | F2:F | Text contains | Cold | Blue fill |

### Status Pipeline (Column H)
| Rule | Apply to range | Format cells if | Value | Style |
|---|---|---|---|---|
| 1 | H2:H | Text contains | New | Light gray fill |
| 2 | H2:H | Text contains | Contacted | Light blue fill |
| 3 | H2:H | Text contains | Quote Sent | Purple fill, white text |
| 4 | H2:H | Text contains | Paid | Green fill, white text |
| 5 | H2:H | Text contains | Lost | Red fill, strikethrough |

### Lead Score Heatmap (Column G)
| Rule | Apply to range | Format cells if | Value / Formula | Style |
|---|---|---|---|---|
| 1 | G2:G | Greater than or equal to | 80 | Dark green fill, white text, bold |
| 2 | G2:G | Greater than or equal to | 50 | Yellow/amber fill |
| 3 | G2:G | Less than | 50 | Red fill |
| 4 | G2:G | Is equal to | (blank) | No fill |

**IMPORTANT**: Order matters for conditional formatting — rules are evaluated top-to-bottom. Add the blank rule last.

---

## Sample Data (for demo)

Paste into A2:I6:

| Date | Lead Name | Phone | Requirement | Budget Fit | Urgency | Score | Status | Next Action |
|---|---|---|---|---|---|---|---|---|
| 2026-07-19 | Acme Corp | 555-0101 | ERP Migration | High | Hot | 100 | New | Call tomorrow |
| 2026-07-19 | Beta Inc | 555-0102 | Website Redesign | Medium | Warm | 50 | Contacted | Send portfolio |
| 2026-07-18 | Gamma LLC | 555-0103 | Cloud Setup | Low | Cold | 0 | Lost | Archive |
| 2026-07-18 | Delta Co | 555-0104 | AI Chatbot | High | Warm | 70 | Quote Sent | Follow up Thu |
| 2026-07-17 | Echo Ltd | 555-0105 | CRM Customization | Medium | Hot | 80 | Paid | Onboard team |

---

## Scoring Logic (for reference)

| Budget Fit | Points | Urgency | Points |
|---|---|---|---|
| High | 40 | Hot | 60 |
| Medium | 20 | Warm | 30 |
| Low | 0 | Cold | 0 |

**Max Score: 100** (High + Hot)
**Blank**: Score cell stays empty until both E and F are filled.

---

## Recording the Tutorial

Follow the shot-by-shot storyboard in `.opencode/commands/tutorial.md`.

### Recommended tools
- **Screen recording**: OBS Studio (free) or Screen Studio ($)
- **Cursor effects**: Mousecape or default Windows cursor at 150%
- **Audio**: Voice-over recorded separately, synced in edit
- **Music**: Pixabay or Uppbeat for royalty-free SaaS tracks
