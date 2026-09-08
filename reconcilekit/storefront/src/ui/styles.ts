export const APP_CSS: string = `:root {
  --bg: #0b1220;
  --bg-soft: #111a2c;
  --panel: #141f35;
  --panel-2: #182c4d;
  --ink: #e8eefc;
  --ink-soft: #9fb0d0;
  --muted: #6b7ba0;
  --line: #22304d;
  --accent: #38bdf8;
  --accent-2: #a78bfa;
  --good: #34d399;
  --warn: #fbbf24;
  --bad: #fb7185;
  --info: #60a5fa;
  --radius: 12px;
  --mono: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
}
* { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: radial-gradient(1200px 600px at 85% -10%, rgba(56,189,248,0.09), transparent 60%),
              radial-gradient(900px 500px at 5% 110%, rgba(167,139,250,0.08), transparent 60%),
              var(--bg);
  color: var(--ink);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.mono { font-family: var(--mono); font-size: 0.86em; letter-spacing: 0.01em; }
.muted { color: var(--muted); }
.small { display: block; font-size: 0.72em; margin-top: 2px; }
.nowrap { white-space: nowrap; }

.site-header {
  display: flex; align-items: center; gap: 22px;
  padding: 14px 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(20,31,53,0.72);
  backdrop-filter: blur(8px);
  position: sticky; top: 0; z-index: 10;
}
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); font-weight: 650; letter-spacing: 0.02em; }
.brand:hover { text-decoration: none; }
.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #081018; }
.brand-mark .icon { width: 20px; height: 20px; }
.brand-text em { font-style: normal; color: var(--accent); }
.site-nav { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
.nav-link { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 9px;
  color: var(--ink-soft); font-size: 0.9em; }
.nav-link .icon { width: 16px; height: 16px; }
.nav-link:hover { background: rgba(56,189,248,0.1); text-decoration: none; color: var(--ink); }
.nav-link.is-active { background: rgba(56,189,248,0.16); color: var(--accent); }
.icon { width: 18px; height: 18px; flex: none; }

.page-banner { display: flex; align-items: center; gap: 8px; padding: 10px 28px;
  background: rgba(251,191,36,0.12); color: var(--warn); border-bottom: 1px solid rgba(251,191,36,0.25);
  font-size: 0.92em; }
.page-banner .icon { width: 16px; height: 16px; }

.container { width: 100%; max-width: 1120px; margin: 0 auto; padding: 28px 28px 48px; flex: 1; }

.site-footer { display: flex; justify-content: space-between; padding: 16px 28px;
  border-top: 1px solid var(--line); font-size: 0.82em; color: var(--muted); }

.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.page-title { font-size: 1.55em; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; }
.page-sub { color: var(--ink-soft); margin: 0; font-size: 0.95em; }
.page-head .actions { display: flex; gap: 10px; }

.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; }
.card + .card { margin-top: 18px; }
.card h3 { margin: 0 0 14px; font-size: 1.05em; font-weight: 650; display: flex; align-items: center; gap: 8px; }
.card h3 .icon { width: 18px; height: 18px; color: var(--accent); }
.grid { display: grid; gap: 18px; }
.grid-2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.grid-3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.grid-4 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }

.stat { padding: 18px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); }
.stat .value { font-size: 1.7em; font-weight: 750; letter-spacing: -0.01em; }
.stat .label { color: var(--ink-soft); font-size: 0.85em; margin-top: 4px; }
.stat.accent { background: linear-gradient(135deg, rgba(56,189,248,0.14), rgba(167,139,250,0.12)); border-color: rgba(56,189,248,0.3); }

.chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
  font-size: 0.78em; font-weight: 600; letter-spacing: 0.02em; border: 1px solid transparent; }
.chip .icon { width: 12px; height: 12px; }
.chip-good { color: var(--good); background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.28); }
.chip-warn { color: var(--warn); background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.28); }
.chip-bad { color: var(--bad); background: rgba(251,113,133,0.12); border-color: rgba(251,113,133,0.28); }
.chip-info { color: var(--info); background: rgba(96,165,250,0.12); border-color: rgba(96,165,250,0.28); }
.chip-muted { color: var(--ink-soft); background: rgba(155,176,208,0.1); border-color: rgba(155,176,208,0.2); }

.table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--line); background: var(--panel); }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
.data-table th { text-align: left; padding: 12px 14px; color: var(--muted); font-size: 0.78em;
  text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--line); white-space: nowrap; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: rgba(56,189,248,0.05); }
.risk-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%;
  background: var(--bad); box-shadow: 0 0 0 3px rgba(251,113,133,0.2); }

.empty-state { padding: 44px 20px; text-align: center; color: var(--muted); }
.empty-state .icon { width: 26px; height: 26px; color: var(--line); }

.detail-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 18px 0 0; }
.back-link { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-soft); font-size: 0.88em; }
.back-link .icon { width: 15px; height: 15px; }

.kv { display: grid; grid-template-columns: max-content 1fr; gap: 8px 22px; font-size: 0.92em; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; font-family: var(--mono); font-size: 0.88em; word-break: break-word; }
.kv .big { font-size: 1.6em; font-weight: 700; letter-spacing: -0.01em; }

.timeline { list-style: none; padding: 0; margin: 0; }
.timeline li { position: relative; padding: 0 0 18px 26px; border-left: 1px solid var(--line); }
.timeline li:last-child { border-left-color: transparent; padding-bottom: 0; }
.timeline li::before { content: ""; position: absolute; left: -5px; top: 4px; width: 9px; height: 9px;
  border-radius: 50%; background: var(--panel-2, var(--accent)); border: 2px solid var(--accent); }
.timeline .t-title { font-weight: 600; font-size: 0.92em; }
.timeline .t-meta { color: var(--muted); font-size: 0.8em; margin-top: 2px; }
.timeline .t-desc { color: var(--ink-soft); font-size: 0.86em; margin-top: 4px; }

.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 9px;
  border: 1px solid var(--line); background: var(--panel-2, #182c4d); color: var(--ink); font-size: 0.9em;
  font-weight: 600; cursor: pointer; }
.btn:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
.btn .icon { width: 15px; height: 15px; }
.btn.primary { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #081018; border: none; }
.btn.primary:hover { filter: brightness(1.08); color: #081018; }
.btn.danger:hover { border-color: var(--bad); color: var(--bad); }
.btn[disabled] { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.notice { display: flex; gap: 10px; align-items: flex-start; padding: 13px 15px; border-radius: 10px;
  border: 1px solid; font-size: 0.9em; }
.notice .icon { width: 18px; height: 18px; margin-top: 1px; }
.notice-info { background: rgba(96,165,250,0.1); border-color: rgba(96,165,250,0.3); color: var(--info); }
.notice-warn { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.3); color: var(--warn); }
.notice-good { background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.3); color: var(--good); }

ul.inline { list-style: none; padding: 0; margin: 0; }
ul.inline li { display: flex; justify-content: space-between; gap: 18px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 0.9em; }
ul.inline li:last-child { border-bottom: none; }

.notif { display: flex; gap: 14px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--line);
  background: var(--panel); margin-bottom: 10px; }
.notif.unread { border-color: rgba(56,189,248,0.4); background: rgba(56,189,248,0.06); }
.notif .notif-title { font-weight: 600; display: flex; align-items: center; gap: 8px; }
.notif .notif-body { color: var(--ink-soft); font-size: 0.9em; margin-top: 4px; }
.notif .notif-meta { color: var(--muted); font-size: 0.78em; margin-top: 6px; display: flex; gap: 12px; align-items: center; }

.proof { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-family: var(--mono); font-size: 0.82em; }
.proof dt { color: var(--muted); }
.proof dd { margin: 0; color: var(--ink-soft); word-break: break-all; }
details.proof-box { border: 1px solid var(--line); border-radius: 10px; background: var(--bg-soft); padding: 4px 0; }
details.proof-box summary { cursor: pointer; padding: 10px 14px; color: var(--ink-soft); font-weight: 600; font-size: 0.9em; }
details.proof-box > .proof-open { padding: 4px 14px 14px; }

.form-grid { display: grid; gap: 12px; }
.field label { display: block; font-size: 0.82em; color: var(--ink-soft); margin-bottom: 6px; }
.field input, .field select { width: 100%; padding: 9px 12px; border-radius: 9px; border: 1px solid var(--line);
  background: var(--bg-soft); color: var(--ink); font-size: 0.92em; font-family: inherit; }
.field input:focus, .field select:focus { outline: none; border-color: var(--accent); }
.kv-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }

.pill-row { display: flex; gap: 10px; flex-wrap: wrap; }
.pill-row a { padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-soft); font-size: 0.85em; }
.pill-row a:hover { text-decoration: none; border-color: var(--accent); color: var(--accent); }
.pill-row a.is-active { background: rgba(56,189,248,0.14); border-color: var(--accent); color: var(--accent); }

.hero { padding: 8px 0 4px; }
.hero h2 { font-size: 1.9em; margin: 0 0 6px; letter-spacing: -0.02em; }
.hero p { color: var(--ink-soft); margin: 0; max-width: 640px; line-height: 1.5; }
.section-label { color: var(--muted); font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.08em; margin: 26px 0 12px; }

.avatar { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #081018; font-weight: 750; }
.gift-card-tile { border: 1px dashed var(--accent); border-radius: 10px; padding: 12px 14px; background: rgba(56,189,248,0.06); }
`;

export const APP_JS: string = `(() => {
  const toggles = document.querySelectorAll("details.proof-box summary");
  toggles.forEach((t) => t.addEventListener("click", () => {
    const box = t.parentElement;
    box.classList.toggle("open");
  }));
})();`;
