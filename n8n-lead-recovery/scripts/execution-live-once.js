"use strict";

/*
 * Single-shot, operator-gated REAL send against the live sheet and Resend.
 *
 * Reads live 'Approved Outreach' + 'Outreach Log' rows, filters the queue down
 * to email-READY leads capped at --limit, then calls executeFromSheets in
 * mode 'REAL' with a GoogleSheetsClient threaded as sheetsWriter (Doc 1E
 * part 3). The pending-append -> provider -> ack-update flow lives in the
 * engine (src/execution.js, bb756e9); this script only gates and drives it.
 *
 * Hard guards:
 *   - NODE_ENV === 'production'             -> exit 3
 *   - missing required env                  -> usage, exit 3
 *   - --limit > 5                           -> exit 3
 *   - no --execute                          -> warn banner, exit 3 (nothing sent)
 *   - --execute without --confirm           -> dry-look banner, exit 0 (nothing sent)
 *   - both flags present                    -> LIVE SEND BANNER + 5s abort window
 *   - providerFor('REAL') sentinel unset    -> exit 3 (nothing sent)
 */

const { GoogleSheetsClient } = require("../src/google-sheets-client");
const {
  buildQueueFromSheets,
  APPROVED_COLUMNS,
  OUTREACH_COLUMNS,
} = require("../src/queue");
const {
  executeFromSheets,
  EXECUTION_STATUS,
} = require("../src/execution");
const {
  providerFor,
  NOT_CONFIGURED_PROVIDER,
} = require("../src/provider");

const REQUIRED_ENV = [
  "GOOGLE_SHEET_ID",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

function printUsage() {
  console.log(`usage: node scripts/execution-live-once.js [--execute] [--confirm] [--limit=N]

Sends REAL email to REAL recipients via Resend and writes the Outreach Log.

required env:
  GOOGLE_SHEET_ID
  GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON (one)
  RESEND_API_KEY
  RESEND_FROM_EMAIL

flags:
  --execute   arm the send (required; without it this script refuses with exit 3)
  --confirm   confirm the send (required; without it a dry-look banner is printed
              and nothing is sent)
  --limit=N   max emails to send in this run; default 1, hard cap 5
`);
}

function parseLimit(argv) {
  let raw = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--limit") {
      raw = argv[i + 1];
    } else if (String(argv[i]).startsWith("--limit=")) {
      raw = String(argv[i]).slice("--limit=".length);
    }
  }
  if (raw === null) return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error("error: --limit must be a positive integer");
    process.exit(3);
  }
  if (n > 5) {
    console.error("error: --limit hard cap is 5; refusing " + n);
    process.exit(3);
  }
  return n;
}

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  const hasToken = Boolean(process.env.GOOGLE_ACCESS_TOKEN);
  const hasSa = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!hasToken && !hasSa) {
    missing.push("GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  if (missing.length) {
    console.error("error: missing required env var(s): " + missing.join(", "));
    printUsage();
    process.exit(3);
  }
}

async function readLiveRows(client) {
  const toObjects = (cols, rows) =>
    rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""])));

  const approvedAll = await client.listRows("Approved Outreach");
  const outreachAll = await client.listRows("Outreach Log");
  const approvedRaw = approvedAll.slice(1); // drop header row
  const outreachRaw = outreachAll.slice(1);

  return {
    approvedRows: toObjects(APPROVED_COLUMNS, approvedRaw),
    outreachRows: toObjects(OUTREACH_COLUMNS, outreachRaw),
  };
}

function preflightEmailQueue({ approvedRows, outreachRows, limit }) {
  const { queue } = buildQueueFromSheets({
    approvedRows,
    outreachRows,
    runId: "EXEC-LIVE-PREFLIGHT-" + Date.now(),
    now: new Date().toISOString(),
  });
  const emailReady = queue.filter(
    (q) =>
      q.readiness_status === "READY" && q.available_channel === "email",
  );
  const selected = emailReady.slice(0, limit);
  const leadIds = new Set(selected.map((q) => q.lead_id));
  const filteredApproved = approvedRows.filter((r) =>
    leadIds.has(String(r.lead_id).trim()),
  );
  return { queue, emailReady, selected, filteredApproved };
}

function bannerPairs(filteredApproved) {
  return filteredApproved.map((r) => ({
    lead_id: String(r.lead_id).trim(),
    email: String(r.email).trim(),
  }));
}

function printPairs(pairs) {
  for (const p of pairs) {
    console.log(`  - ${p.lead_id} → ${p.email}`);
  }
}

function reportWarn(message) {
  console.warn(`  [warn] ${message}`);
}

(async () => {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "This script sends real email to real recipients; refusing to run under NODE_ENV=production.",
    );
    process.exit(3);
  }

  const argv = process.argv.slice(2);
  const hasExecute = argv.includes("--execute");
  const hasConfirm = argv.includes("--confirm");
  const limit = parseLimit(argv);

  validateEnv();

  if (!hasExecute) {
    console.error(
      "Refusing to run: this script sends real email to real recipients. " +
        "Re-run with --execute (and --confirm) to arm the send.",
    );
    process.exit(3);
  }

  const client = GoogleSheetsClient.fromEnv(process.env);

  let approvedRows;
  let outreachRows;
  try {
    const rows = await readLiveRows(client);
    approvedRows = rows.approvedRows;
    outreachRows = rows.outreachRows;
  } catch (err) {
    console.error("FAILED reading live sheet:", err.message);
    process.exit(1);
  }
  console.log("[debug] approvedRaw rows:", approvedRows.length);
  console.log("[debug] outreachRaw rows:", outreachRows.length);

  const { emailReady, selected, filteredApproved } = preflightEmailQueue({
    approvedRows,
    outreachRows,
    limit,
  });
  const pairs = bannerPairs(filteredApproved);
  const K = pairs.length;
  console.log(
    `[preflight] ${approvedRows.length} approved rows → ${emailReady.length} email-ready → ${K} selected by --limit=${limit}`,
  );

  const from = process.env.RESEND_FROM_EMAIL;

  if (!hasConfirm) {
    console.log("--- DRY-LOOK (--confirm not provided; nothing will be sent) ---");
    console.log("Provider:  RESEND");
    console.log(`From:      ${from}`);
    console.log(`Sending:   ${K} email(s)`);
    printPairs(pairs);
    process.exit(0);
  }

  console.log("=== LIVE SEND BANNER ===");
  console.log("Provider:  RESEND");
  console.log(`From:      ${from}`);
  console.log(`Sending:   ${K} email(s)`);
  printPairs(pairs);
  console.log("Press Ctrl-C within 5 seconds to abort.");
  await new Promise((r) => setTimeout(r, 5000));

  const provider = providerFor("REAL");
  if (provider === NOT_CONFIGURED_PROVIDER || !provider.isConfigured()) {
    console.error(
      "RESEND_API_KEY is not set; providerFor('REAL') returned the " +
        "NOT_CONFIGURED sentinel. Execution refused, nothing was sent.",
    );
    process.exit(3);
  }

  const result = await executeFromSheets({
    approvedRows: filteredApproved,
    outreachRows,
    messageVariants: {},
    mode: "REAL",
    provider,
    sheetsWriter: client,
    outreachTabName: "Outreach Log",
    runId: "EXEC-LIVE-" + Date.now(),
    now: new Date().toISOString(),
  });

  const report = result.report || result;

  console.log("--- execution report (REAL) ---");
  console.log("status:", report.status);
  console.log("run_id:", report.run_id);
  console.log("mode:", report.mode);
  console.log("provider:", report.provider);
  console.log("provider_configured:", report.provider_configured);
  console.log("writer counters:");
  console.log("  pending_rows_appended:    ", report.pending_rows_appended);
  console.log("  ack_updates_attempted:    ", report.ack_updates_attempted);
  console.log("  ack_updates_succeeded:    ", report.ack_updates_succeeded);
  console.log("  failure_updates_attempted:", report.failure_updates_attempted);
  console.log("  log_append_failures:      ", report.log_append_failures);
  console.log("  log_rows_written:         ", report.log_rows_written);

  console.log("--- per-lead outcomes ---");
  const results = result.results || [];
  for (const r of results) {
    const call = r.provider_call || {};
    console.log(
      JSON.stringify({
        lead_id: r.lead_id,
        channel: r.channel,
        status: r.status,
        reason: r.reason,
        detail: r.detail,
        provider_message_id: call.provider_message_id || "",
        ack_update_failed: r.ack_update_failed || false,
      }),
    );
  }

  let warned = false;
  if (report.status !== "COMPLETED") {
    reportWarn(`report.status = ${report.status}; expected COMPLETED`);
    warned = true;
  }
  if (report.pending_rows_appended !== K) {
    reportWarn(
      `pending_rows_appended = ${report.pending_rows_appended}; expected ${K}`,
    );
    warned = true;
  }
  if (report.ack_updates_succeeded !== report.executed_succeeded) {
    reportWarn(
      `ack_updates_succeeded = ${report.ack_updates_succeeded} !== executed_succeeded = ${report.executed_succeeded}; some pending rows may not have been ack-updated`,
    );
    warned = true;
  }
  if (report.log_append_failures > 0) {
    reportWarn(
      `${report.log_append_failures} Outreach Log append failure(s); inspect the 'Outreach Log' tab (rows may be marked FAILED)`,
    );
    warned = true;
  }
  if (!warned) {
    console.log("OK: no post-run warnings.");
  }
  console.log("done (exiting 0).");
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});