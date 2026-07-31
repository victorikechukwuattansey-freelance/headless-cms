---
description: Production script for the Google Sheets CRM tutorial video.
---

# Google Sheets CRM — Tutorial Production Script

## Sheet Setup Reference

**File**: `scripts/google-sheets-crm.gsheet.md` contains the exact formulas.

### Column Layout (A-I)
| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Date | Lead Name | Phone Number | Requirement | Budget Fit | Urgency | Lead Score | Status | Next Action |

### Lead Score Formula (cell G2, drag down)
```
=IF(AND(E2<>"",F2<>""),
  IF(E2="High",40,IF(E2="Medium",20,IF(E2="Low",0,0)))
  + IF(F2="Hot",60,IF(F2="Warm",30,IF(F2="Cold",0,0))),
  "")
```

### Data Validation

| Column | Range | Values |
|---|---|---|
| Budget Fit (E) | E2:E | High, Medium, Low |
| Urgency (F) | F2:F | Hot, Warm, Cold |
| Status (H) | H2:H | New, Contacted, Quote Sent, Paid, Lost |

### Conditional Formatting Rules

| Column | Condition | Format |
|---|---|---|
| Budget Fit (E) | =E2="High" | Green fill, bold |
| Budget Fit (E) | =E2="Medium" | Yellow/amber fill |
| Budget Fit (E) | =E2="Low" | Red fill |
| Urgency (F) | =F2="Hot" | Red fill, bold |
| Urgency (F) | =F2="Warm" | Yellow/amber fill |
| Urgency (F) | =F2="Cold" | Blue fill |
| Status (H) | =H2="New" | Light gray fill |
| Status (H) | =H2="Contacted" | Light blue fill |
| Status (H) | =H2="Quote Sent" | Purple fill |
| Status (H) | =H2="Paid" | Green fill |
| Status (H) | =H2="Lost" | Red fill, strikethrough |
| Lead Score (G) | =G2>=80 | Dark green fill, white text |
| Lead Score (G) | =G2>=50 | Yellow/amber fill |
| Lead Score (G) | =G2>=1 | Red fill |
| Lead Score (G) | =G2="" | No fill (blank) |

### Sample Data

| Date | Lead Name | Phone | Requirement | Budget Fit | Urgency | Score | Status | Next Action |
|---|---|---|---|---|---|---|---|---|
| 2026-07-19 | Acme Corp | 555-0101 | ERP Migration | High | Hot | 100 | New | Call tomorrow |
| 2026-07-19 | Beta Inc | 555-0102 | Website Redesign | Medium | Warm | 50 | Contacted | Send portfolio |
| 2026-07-18 | Gamma LLC | 555-0103 | Cloud Setup | Low | Cold | 0 | Lost | Archive |
| 2026-07-18 | Delta Co | 555-0104 | AI Chatbot | High | Warm | 70 | Quote Sent | Follow up Thu |
| 2026-07-17 | Echo Ltd | 555-0105 | CRM Customization | Medium | Hot | 80 | Paid | Onboard team |

---

## Storyboard

**Total runtime**: ~2:00

---

### SHOT 1 — Opening Title (0:00–0:07)

```
VISUAL: Clean white background. Fade in centered headline.

  "Automated Lead Scoring & Smart Sales Pipeline"
  "in Google Sheets"

Below in lighter text: "A step-by-step tutorial"

TRANSITION: Soft crossfade (0.5s)

AUDIO: Light, upbeat SaaS background music starts
NARRATION: None — title card only
```

---

### SHOT 2 — Empty Sheet Reveal (0:07–0:20)

```
VISUAL: Google Sheets opens. Empty columns A–I with headers already in place.

ZOOM: Slow zoom-in to the header row (columns A–I)

CAMERA MOTION: Smooth pan across headers —
  Date | Lead Name | Phone Number | Requirement | Budget Fit | Urgency | Lead Score | Status | Next Action

CURSOR: Moves deliberately across each header, pausing briefly at "Budget Fit" and "Urgency"

HIGHLIGHT: Subtle blue glow pulse on column G ("Lead Score")

HUD ELEMENT: Small label appears: "Column G — Fully Automated"
  Disappears after 3 seconds

AUDIO: Soft keyboard click sounds synchronized with cursor movement
NARRATION: "Meet your new sales pipeline tracker. Nine columns. One goal: let the spreadsheet do the heavy lifting."
```

---

### SHOT 3 — Adding a Lead (0:20–0:35)

```
VISUAL: First row (row 2) — all cells empty.

CURSOR: Moves to A2 (Date), types "2026-07-19"

CURSOR: Moves to B2 (Lead Name), types "Acme Corp"

CURSOR: Moves to C2 (Phone), types "555-0101"

CURSOR: Moves to D2 (Requirement), types "ERP Migration"

ZOOM: Slight zoom-in to columns E, F, G

AUDIO: Rhythmic typing sounds
NARRATION: "Enter your lead details manually — date, name, phone, requirement. Now watch what happens next."
```

---

### SHOT 4 — Dropdown Selection — Budget Fit (0:35–0:50)

```
VISUAL: Cell E2 is selected. A dropdown arrow appears.

CURSOR: Clicks the dropdown arrow

ANIMATION: Dropdown menu expands smoothly with options: High, Medium, Low

CURSOR: Moves down to "High" and clicks

EFFECT: Cell E2 instantly fills "High" with green color (conditional formatting activates)

MICRO-INTERACTION: Brief green flash animation on cell (0.2s soften)

HUD: Small floating badge: "Budget Fit: High → +40 points"

AUDIO: Satisfying "pop" on selection, soft "whoosh" for color change
NARRATION: "Budget Fit captures the lead's spending capacity. High, Medium, or Low — each option auto-colors for instant visual cues."
```

---

### SHOT 5 — Dropdown Selection — Urgency (0:50–1:02)

```
VISUAL: Cell F2 is selected. Dropdown arrow appears.

CURSOR: Opens dropdown, selections: Hot, Warm, Cold

CURSOR: Selects "Hot"

EFFECT: Cell F2 fills "Hot" with red color immediately

ZOOM: Slow zoom toward cell G2 (Lead Score) — currently still blank

CURSOR: Hovers over G2

EFFECT: Cell G2 calculates "100" in bold green text — instantly

MICRO-INTERACTION: Brief number counter animation: 0 → 100 (0.3s)

HUD: Splash effect — "100" with a glowing ring, then fades

SMALL LABEL: "Budget Fit (40) + Urgency (60) = 100"

AUDIO: Rising chime sound as score fills in
NARRATION: "Urgency tells you how fast they need to move. Select Hot, and the Lead Score auto-calculates to a perfect 100 — no formulas to touch."
```

---

### SHOT 6 — Formula Integrity Demo (1:02–1:15)

```
VISUAL: Split-screen or zoom-in on formula bar showing:

  =IF(AND(E2<>"",F2<>""),
    IF(E2="High",40,IF(E2="Medium",20,IF(E2="Low",0,0)))
    + IF(F2="Hot",60,IF(F2="Warm",30,IF(F2="Cold",0,0))),
    "")

CURSOR: Highlights the formula from left to right

ZOOM: Zoom out to full sheet view

CURSOR: Clicks into G3 (empty row), shows cell is blank/empty

CURSOR: Enters "50" manually in G3

EFFECT: Red blinking border appears around G3

HUD: Warning icon + text: "DO NOT overwrite formulas — score calculates automatically"

CURSOR: Presses Delete to clear, cell returns to blank

AUDIO: Error buzz briefly on manual entry, then "correct" ding after delete
NARRATION: "The formula is locked in. Never overwrite the Score column — let the logic work for you. Only Budget Fit and Urgency need your input."
```

---

### SHOT 7 — Adding Multiple Leads + Status Pipeline (1:15–1:35)

```
VISUAL: Sheet populated with 5 sample leads (rows 2–6)

CURSOR: Smooth scrolling through rows

ZOOM: Pull back to show full table

EFFECT: Each Status value has its own color:
  - "Contacted" → light blue
  - "Quote Sent" → purple  
  - "Paid" → green
  - "Lost" → red strikethrough

CURSOR: Hovers over Status column H, highlighting the color-coded cells

HUD: Small legends pop in briefly:
  "Status Pipeline: New → Contacted → Quote Sent → Paid → Lost"

ZOOM: Slow zoom to show all score values in column G with their heatmap colors:
  - 100 (dark green)
  - 80 (dark green)
  - 70 (amber)
  - 50 (amber)
  - 0 (red)

AUDIO: Upbeat tempo increase in background track
NARRATION: "Add your leads. Update their status through the pipeline — New, Contacted, Quote Sent, Paid, or Lost. Each value triggers its own color instantly. The Lead Score heatmap highlights your hottest prospects in green, medium in yellow, low in red."
```

---

### SHOT 8 — Final Pipeline Reveal (1:35–2:00)

```
VISUAL: Full sheet visible, all 5 rows populated and color-coded

CAMERA: Slow zoom out to show the entire sheet with all formatting active

EFFECT: Rows sorted by Lead Score descending (highest priority on top)

HIGHLIGHT: The "Acme Corp" row (Score: 100, Status: New) has a subtle pulsing gold border — "PRIORITY"

HUD: Final headline flies in from bottom with smooth easing:

  "Automated Lead Scoring & Smart Sales Pipeline"
  "in Google Sheets"

Below: "Try it yourself → [link]"

EFFECT: Soft vignette darkens edges, spotlight on the sheet

AUDIO: Music swells to conclusion, final chord hold
NARRATION: "Automated scoring. Color-coded priorities. A complete sales pipeline in one sheet. Try it for yourself and close more deals."
```

---

## Production Notes

| Element | Spec |
|---|---|
| Resolution | 1920×1080 (16:9) |
| Frame rate | 30 fps |
| Recording tool | OBS / Screen Studio / Loom |
| Font | Inter or system sans-serif |
| Color palette | Google Sheets default + custom green/amber/red |
| Cursor | Custom, larger than default, with soft glow |
| Transitions | Crossfade (0.3–0.5s) |
| Background music | Upbeat corporate SaaS (lo-fi) |
| Narration | Clear, warm voice, moderate pace |
| Export | MP4 H.264, ~10 Mbps |
