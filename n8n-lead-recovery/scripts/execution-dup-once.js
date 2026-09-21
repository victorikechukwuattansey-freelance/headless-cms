"use strict";

// Hermetic dedup test. No Sheets, no creds, no fixtures file.
// Seeds 3 approved call-channel leads + 1 pre-sent Outreach Log row for lead #1,
// asserts gateExecution suppresses the dup and the other 2 short-circuit on DRY_RUN.
//
// Row shape mirrors src/execution-fixtures.js TEST-EXEC-001.

const {
  executeFromSheets,
  MODE,
  EXECUTION_STATUS,
} = require("../src/execution");

const LEAD_1 = "FSQ-PHONE-5122226666";
const LEAD_2 = "FSQ-PHONE-5122572653";
const LEAD_3 = "FSQ-PHONE-5122803843";

function approvedRow(lead_id, business_name, phone) {
  return {
    approval_id: "",
    lead_id,
    business_name,
    contact_name: "",
    niche: "",
    city: "",
    state: "",
    phone,
    email: "",
    website: "",
    verification_source: "",
    score: "90",
    channel: "call",
    campaign_name: "",
    message_variant: "",
    approval_stage: "",
    approved_by: "",
    approved_at: "2026-09-01T09:00:00.000Z",
    scheduled_date: "",
    status: "not_ready",
    notes: "",
    contact_source_provider: "",
    contact_blocked: "",
    country: "",
    email_verified: "",
  };
}

const approvedRows = [
  approvedRow(LEAD_1, "Blue Sky Heating and Air", "5122226666"),
  approvedRow(LEAD_2, "Bishop's Air Control", "5122572653"),
  approvedRow(LEAD_3, "Climate Control", "5122803843"),
];

// The dedup trigger. REQUIRES both lead_id and sent_at — buildSentIndex drops
// any row missing either. channel must match the queue item's available_channel.
const outreachRows = [
  {
    lead_id: LEAD_1,
    channel: "call",
    sent_at: "2026-09-19T00:00:00.000Z",
    outreach_id: `EX-${LEAD_1}-call`,
  },
];

(async () => {
  const result = await executeFromSheets({
    approvedRows,
    outreachRows,
    mode: MODE.DRY_RUN,
    provider: null,
    runId: "EXEC-DUP-" + Date.now(),
    now: new Date().toISOString(),
  });

  const r = result.report || {};
  const results = result.results || [];

  console.log("--- per-lead outcomes ---");
  for (const x of results) {
    console.log(
      JSON.stringify({
        lead_id: x.lead_id,
        status: x.status,
        reason: x.reason,
        detail: x.detail,
      }),
    );
  }
  console.log("--- report (subset) ---");
  console.log(
    JSON.stringify(
      {
        mode: r.mode,
        queue_total: r.queue_total,
        duplicate_suppressed: r.duplicate_suppressed,
        executed_attempted: r.executed_attempted,
        executed_succeeded: r.executed_succeeded,
        executed_skipped: r.executed_skipped,
        log_rows_written: r.log_rows_written,
        provider_calls: r.provider_calls,
      },
      null,
      2,
    ),
  );

  const fail = (m) => {
    console.error("ASSERT FAILED: " + m);
    process.exit(1);
  };

  if (r.mode !== "DRY_RUN") fail(`mode = ${r.mode}`);
  if (r.queue_total !== 3) fail(`queue_total = ${r.queue_total}, expected 3`);
  if (r.duplicate_suppressed !== 1)
    fail(`duplicate_suppressed = ${r.duplicate_suppressed}, expected 1`);
  if (r.executed_attempted !== 0)
    fail(`executed_attempted = ${r.executed_attempted}`);
  if (r.executed_succeeded !== 0)
    fail(`executed_succeeded = ${r.executed_succeeded}`);
  if (r.executed_skipped !== 2)
    fail(`executed_skipped = ${r.executed_skipped}, expected 2`);

  // Bucket conservation: every queue item lands in exactly one outcome bucket.
  const accounted =
    r.executed_attempted +
    r.executed_skipped +
    r.executed_rejected +
    r.duplicate_suppressed;
  if (accounted !== r.queue_total) {
    fail(`buckets sum to ${accounted}, queue_total = ${r.queue_total}`);
  }
  if (r.log_rows_written !== 0)
    fail(`log_rows_written = ${r.log_rows_written}`);
  if (r.provider_calls !== 0) fail(`provider_calls = ${r.provider_calls}`);
  if ((result.logRows || []).length !== 0)
    fail(`logRows.length = ${(result.logRows || []).length}, expected 0`);

  const dup = results.filter((x) => x.reason === "DUPLICATE");
  if (dup.length !== 1) fail(`DUPLICATE results = ${dup.length}, expected 1`);
  if (dup[0].lead_id !== LEAD_1)
    fail(`DUPLICATE lead_id = ${dup[0].lead_id}, expected ${LEAD_1}`);
  if (dup[0].status !== "DUPLICATE_SUPPRESSED")
    fail(`DUPLICATE status = ${dup[0].status}`);
  if (dup[0].provider_call !== null)
    fail(`DUPLICATE reached provider: ${JSON.stringify(dup[0].provider_call)}`);

  const dry = results.filter((x) => x.reason === "DRY_RUN");
  if (dry.length !== 2) fail(`DRY_RUN results = ${dry.length}, expected 2`);

  if (results.some((x) => x.status === EXECUTION_STATUS.SUCCEEDED))
    fail("SUCCEEDED present");

  console.log(
    "OK: dup-suppression verified — 1 DUPLICATE, 2 DRY_RUN, 0 sent, 0 logged.",
  );
})().catch((err) => {
  console.error("FAILED:", err && err.stack ? err.stack : err);
  process.exit(1);
});
