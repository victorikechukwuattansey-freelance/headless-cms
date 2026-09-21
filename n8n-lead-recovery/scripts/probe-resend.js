'use strict';

/*
 * Resend sandbox probe — one-shot manual diagnostic (Doc 1 §2/§4, adapter Doc 1D prep).
 *
 * Answers three questions that docs alone cannot:
 *   1. Does Resend honor Idempotency-Key for at-most-once delivery?
 *   2. What is the exact response field name for the message id (provider_message_id)?
 *   3. What does a rate-limit / error response shape look like (Retry-After present)?
 *
 * Operator-run only. NOT wired into the verify ladder, NOT run in CI. Refuses to run
 * under NODE_ENV=production and when RESEND_API_KEY / PROBE_TO_EMAIL are unset.
 * Exit 0 means the probe ran; the verdict block is the output.
 */

const crypto = require('crypto');

const API = 'https://api.resend.com/emails';

function usage() {
  console.error(
    [
      'Resend sandbox probe — requires:',
      '  RESEND_API_KEY   (sandbox key, e.g. re_...)',
      '  PROBE_TO_EMAIL   (recipient for the probe send; keep to your own address)',
      'Optional:',
      '  RESEND_FROM_EMAIL (defaults to onboarding@resend.dev)',
      'Usage: node scripts/probe-resend.js',
    ].join('\n')
  );
}

async function probeOnce(key, body, extraHeaders = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON body — keep raw text */
  }
  const headers = {};
  for (const [k, v] of res.headers.entries()) {
    headers[k] = v;
  }
  return { status: res.status, body: parsed ?? text, headers };
}

function isIdentifierValue(v) {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    (v.includes('_') || /^[A-Za-z0-9-]{8,}$/.test(v))
  );
}

(async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV=production (development/diagnostic tool only)');
    process.exit(3);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PROBE_TO_EMAIL;
  if (!apiKey || !to) {
    usage();
    process.exit(3);
  }

  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  console.log('=== Resend Sandbox Probe ===');
  console.log(`From:    ${from}`);
  console.log(`To:      ${to}`);
  console.log('Press Ctrl-C now if this looks wrong...');
  console.log('');

  // --- Probe 1: Idempotency-Key honored? ---
  const key1 = 'probe-' + crypto.randomUUID();
  const body1 = { from, to, subject: 'Probe 1', text: 'Idempotency test' };

  const first = await probeOnce(apiKey, body1, { 'Idempotency-Key': key1 });
  const second = await probeOnce(apiKey, body1, { 'Idempotency-Key': key1 });

  const firstBody = typeof first.body === 'object' ? first.body : { raw: first.body };
  const secondBody = typeof second.body === 'object' ? second.body : { raw: second.body };

  const idCandidates = ['id', 'message_id', 'email_id'];
  const firstId = idCandidates.find((k) => firstBody[k]) ? firstBody[idCandidates.find((k) => firstBody[k])] : null;
  const secondId = idCandidates.find((k) => secondBody[k]) ? secondBody[idCandidates.find((k) => secondBody[k])] : null;

  console.log('--- Probe 1: Idempotency-Key (same key, sent twice) ---');
  console.log('Request 1:', first.status, JSON.stringify(first.body));
  console.log('Request 2:', second.status, JSON.stringify(second.body));
  console.log('Idempotent-Replayed (resp1):', first.headers['idempotent-replayed'] || '(absent)');
  console.log('Idempotent-Replayed (resp2):', second.headers['idempotent-replayed'] || '(absent)');

  const idempotencyHonored =
    first.status === second.status && firstId !== null && firstId === secondId ? 'yes' : 'no';
  console.log('');

  // --- Probe 2: response field name ---
  const probe2Body = first.status < 300 ? firstBody : secondBody;
  const probe2Status = first.status < 300 ? first.status : second.status;

  console.log('--- Probe 2: response id field ---');
  console.log('Response status:', probe2Status);
  console.log('Object.keys:', JSON.stringify(Object.keys(probe2Body)));
  const idField = idCandidates.find((k) => probe2Body[k]);
  if (idField) {
    console.log(`id field "${idField}" =`, probe2Body[idField]);
  } else {
    console.log('(no id/message_id/email_id key found)');
  }
  console.log('');

  // --- Probe 3: rate-limit / error shape (non-sending, no send quota) ---
  let probe3 = null;
  for (const url of ['https://api.resend.com/domains', 'https://api.resend.com/api-keys']) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    const headers = {};
    for (const [k, v] of res.headers.entries()) {
      headers[k] = v;
    }
    probe3 = { status: res.status, body: parsed ?? text, headers, endpoint: url };
    console.log(`--- Probe 3 probe (${url}): ${res.status} ---`);
    if (res.status >= 300) break;
  }

  console.log('--- Probe 3: rate-limit/error response shape ---');
  console.log('Endpoint:', probe3.endpoint);
  console.log('Status:', probe3.status);
  const interestingHeaders = [
    'retry-after',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'x-ratelimit-bucket',
    'rate-limit-limit',
    'rate-limit-remaining',
    'rate-limit-reset',
  ];
  const headerSubset = {};
  for (const h of interestingHeaders) {
    if (probe3.headers[h] !== undefined) headerSubset[h] = probe3.headers[h];
  }
  console.log('Rate-limit headers:', Object.keys(headerSubset).length ? JSON.stringify(headerSubset) : '(none)');
  console.log('Body:', JSON.stringify(probe3.body));
  const retryAfter = 'retry-after' in probe3.headers;

  // --- Verdict block ---
  console.log('');
  console.log('=== Resend Probe Verdict ===');
  console.log(`Idempotency-Key honored: ${idempotencyHonored}`);
  console.log(`Response id field: ${idField || '(unknown)'}`);
  console.log(`Rate-limit Retry-After: ${retryAfter ? 'present' : probe3.status === 200 ? 'n/a' : 'absent'}`);
  console.log(`Raw probe 1: ${first.status} ${JSON.stringify(first.body)}`);
  console.log(`Raw probe 2: ${second.status} ${JSON.stringify(second.body)}`);
  console.log(
    `Raw probe 3: ${probe3.status} ${JSON.stringify(headerSubset)} ${JSON.stringify(probe3.body)}`
  );

  process.exit(0);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});