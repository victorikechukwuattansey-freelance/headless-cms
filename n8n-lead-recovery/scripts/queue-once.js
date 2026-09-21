'use strict';

const { buildQueueFromSheets, APPROVED_COLUMNS, OUTREACH_COLUMNS } = require('../src/queue');

(async () => {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!sheetId || !token) {
    console.error('GOOGLE_SHEET_ID and GOOGLE_ACCESS_TOKEN are required');
    process.exit(3);
  }

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRange = async (range) => {
    const r = await fetch(`${base}/${encodeURIComponent(range)}`, { headers });
    const j = await r.json();
    if (!r.ok) throw new Error(`Sheets API ${r.status}: ${j.error ? j.error.message : ''}`);
    return j.values || [];
  };

  const toObjects = (cols, rows) =>
    rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ''])));

  const approvedRaw = await fetchRange("'Approved Outreach'!A2:X");
  const outreachRaw = await fetchRange("'Outreach Log'!A2:T");

  console.log('[debug] approvedRaw rows:', approvedRaw.length);
  console.log('[debug] outreachRaw rows:', outreachRaw.length);

  const approvedRows = toObjects(APPROVED_COLUMNS, approvedRaw);
  const outreachRows = toObjects(OUTREACH_COLUMNS, outreachRaw);

  const result = buildQueueFromSheets({
    approvedRows,
    outreachRows,
    approvedError: '',
    outreachError: '',
    runId: 'QUEUE-' + Date.now(),
    now: new Date().toISOString(),
  });

  console.log('[debug] result keys:', Object.keys(result));

  console.log(JSON.stringify({
    status: result.status,
    queue_total: result.queue_total,
    ready_count: result.ready_count,
    call_ready_count: result.call_ready_count,
    email_ready_count: result.email_ready_count,
    not_ready_count: result.not_ready_count,
    blocked_count: result.blocked_count,
    exception_count: result.exception_count,
    queue: (result.queue || []).map((q) => ({
      lead_id: q.lead_id,
      business_name: q.business_name,
      channel: q.available_channel,
      readiness: q.readiness_status,
      priority: q.priority,
      reason: q.reason,
    })),
    exceptions: result.exceptions,
  }, null, 2));
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
