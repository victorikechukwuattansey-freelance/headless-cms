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
// any row missing either. This example provides a confirmed row, so it
// suppresses. (A row with a known lead_id but no sent_at would hold the lead
// LOG_INCONSISTENT instead; see the malformed case below.) channel must match
// the queue item's available_channel.
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

  // --- malformed-row case: identity-known row with empty sent_at is held ---
  // Same 3-lead shape; LEAD_1's outreach row is malformed (lead_id present,
  // sent_at ""). Fail-closed: held LOG_INCONSISTENT, never sent, never deduped.
  const malformedResult = await executeFromSheets({
    approvedRows,
    outreachRows: [
      {
        lead_id: LEAD_1,
        channel: "call",
        sent_at: "",
        outreach_id: `EX-${LEAD_1}-call`,
      },
    ],
    mode: MODE.DRY_RUN,
    provider: null,
    runId: "EXEC-MALFORMED-" + Date.now(),
    now: new Date().toISOString(),
  });

  const mr = malformedResult.report || {};
  const mresults = malformedResult.results || [];

  console.log("--- per-lead outcomes (malformed-row case) ---");
  for (const x of mresults) {
    console.log(
      JSON.stringify({
        lead_id: x.lead_id,
        status: x.status,
        reason: x.reason,
        detail: x.detail,
      }),
    );
  }

  if (mr.queue_total !== 3) fail(`malformed queue_total = ${mr.queue_total}, expected 3`);
  if (mr.ambiguous_log_rows !== 1) fail(`ambiguous_log_rows = ${mr.ambiguous_log_rows}, expected 1`);
  if (mr.duplicate_suppressed !== 0)
    fail(`malformed duplicate_suppressed = ${mr.duplicate_suppressed}, expected 0`);
  if (mr.executed_attempted !== 0)
    fail(`malformed executed_attempted = ${mr.executed_attempted}`);
  if (mr.executed_succeeded !== 0)
    fail(`malformed executed_succeeded = ${mr.executed_succeeded}`);
  if (mr.executed_skipped !== 3)
    fail(`malformed executed_skipped = ${mr.executed_skipped}, expected 3`);
  if (mr.log_rows_written !== 0) fail(`malformed log_rows_written = ${mr.log_rows_written}`);
  if (mr.provider_calls !== 0) fail(`malformed provider_calls = ${mr.provider_calls}`);

  const mAccounted =
    mr.executed_attempted +
    mr.executed_skipped +
    mr.executed_rejected +
    mr.duplicate_suppressed;
  if (mAccounted !== mr.queue_total) {
    fail(`malformed buckets sum to ${mAccounted}, queue_total = ${mr.queue_total}`);
  }

  const held = mresults.filter((x) => x.reason === "LOG_INCONSISTENT");
  if (held.length !== 1) fail(`LOG_INCONSISTENT results = ${held.length}, expected 1`);
  if (held[0].lead_id !== LEAD_1)
    fail(`LOG_INCONSISTENT lead_id = ${held[0].lead_id}, expected ${LEAD_1}`);
  if (held[0].status !== "EXECUTION_SKIPPED")
    fail(`LOG_INCONSISTENT status = ${held[0].status}, expected EXECUTION_SKIPPED`);
  if (held[0].provider_call !== null)
    fail(`LOG_INCONSISTENT reached provider: ${JSON.stringify(held[0].provider_call)}`);

  const mDry = mresults.filter((x) => x.reason === "DRY_RUN");
  if (mDry.length !== 2) fail(`malformed DRY_RUN results = ${mDry.length}, expected 2`);

  console.log(
    "OK: malformed-row fail-closed verified — 1 LOG_INCONSISTENT (held), 2 DRY_RUN, 0 sent, 0 logged.",
  );
})().catch((err) => {
  console.error("FAILED:", err && err.stack ? err.stack : err);
  process.exit(1);
});
