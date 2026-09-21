"use strict";

const {
  buildQueueFromSheets,
  APPROVED_COLUMNS,
  OUTREACH_COLUMNS,
} = require("../src/queue");
const {
  executeFromSheets,
  MODE,
  EXECUTION_STATUS,
} = require("../src/execution");

(async () => {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!sheetId || !token) {
    console.error("GOOGLE_SHEET_ID and GOOGLE_ACCESS_TOKEN are required");
    process.exit(3);
  }

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRange = async (range) => {
    const r = await fetch(`${base}/${encodeURIComponent(range)}`, { headers });
    const j = await r.json();
    if (!r.ok)
      throw new Error(
        `Sheets API ${r.status}: ${j.error ? j.error.message : ""}`,
      );
    return j.values || [];
  };

  const toObjects = (cols, rows) =>
    rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));

  const approvedRaw = await fetchRange("'Approved Outreach'!A2:X");
  const outreachRaw = await fetchRange("'Outreach Log'!A2:V");

  console.log("[debug] approvedRaw rows:", approvedRaw.length);
  console.log("[debug] outreachRaw rows:", outreachRaw.length);

  const approvedRows = toObjects(APPROVED_COLUMNS, approvedRaw);
  const outreachRows = toObjects(OUTREACH_COLUMNS, outreachRaw);

  const result = await executeFromSheets({
    approvedRows,
    outreachRows,
    mode: MODE.DRY_RUN,
    provider: null,
    runId: "EXEC-" + Date.now(),
    now: new Date().toISOString(),
  });

  console.log("[debug] result keys:", Object.keys(result));

  const results = result.results || result.items || result.queue || [];
  console.log("--- execution projection (DRY_RUN) ---");
  for (const r of results) {
    console.log(
      JSON.stringify({
        lead_id: r.lead_id ?? r.leadId ?? r.lead,
        status: r.status,
        reason: r.reason,
        channel: r.channel,
        to: r.payload?.phone ?? r.payload?.email ?? null,
        detail: r.detail,
      }),
    );
  }

  console.log("--- report ---");
  console.log(JSON.stringify(result.report ?? {}, null, 2));

  const r = result.report || {};
  const mustBeZero = [
    "executed_attempted",
    "executed_succeeded",
    "executed_failed",
    "log_rows_written",
    "provider_calls",
    "duplicate_suppressed",
    "executed_rejected",
  ];
  for (const k of mustBeZero) {
    if (r[k] !== 0) {
      console.error(`ASSERT FAILED: report.${k} = ${r[k]}, expected 0`);
      process.exit(1);
    }
  }
  if (r.mode !== "DRY_RUN") {
    console.error(`ASSERT FAILED: mode = ${r.mode}`);
    process.exit(1);
  }
  const accounted =
    r.executed_attempted +
    r.executed_skipped +
    r.executed_rejected +
    r.duplicate_suppressed;
  if (accounted !== r.queue_total) {
    console.error(
      `ASSERT FAILED: buckets sum to ${accounted}, queue_total = ${r.queue_total}`,
    );
    process.exit(1);
  }

  const logRows = result.logRows || [];
  if (logRows.length !== 0) {
    console.error("ASSERT FAILED: expected 0 log rows, got " + logRows.length);
    process.exit(1);
  }
  if (results.some((r) => r.status === EXECUTION_STATUS.SUCCEEDED)) {
    console.error("ASSERT FAILED: SUCCEEDED in DRY_RUN");
    process.exit(1);
  }
  if (results.length && !results.every((r) => r.reason === "DRY_RUN")) {
    console.error("ASSERT FAILED: not all reasons are DRY_RUN");
    process.exit(1);
  }
  console.log("OK: " + results.length + " item(s) gated, 0 sent, 0 logged.");
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
