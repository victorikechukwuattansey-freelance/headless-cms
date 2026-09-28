/**
 * Regression tests for the five defects fixed across three passes.
 *
 *   F1 - 01 - Lead Intake / `Prepare Email Content`
 *        The node re-emitted the output of the Google Sheets
 *        `Update Lead Next Follow-up` node, which replaces $json with the sheet
 *        row. The tenant config and escaped HTML fields the email branches gate
 *        on are not sheet columns, so both email branches were skipped and
 *        `booking_link_sent` was never written.
 *
 *   F5 - 04 - Status Update / `Build Status Update Record`
 *        The node read the output of the Google Sheets `Update Lead` node.
 *        old_status / new_status / updated_by are not sheet columns, so every
 *        `status_updates` row recorded them blank.
 *
 *   F9 - 01 - Lead Intake / `Resolve Config & Normalize Lead`
 *        The node took `$('Get Business Config').first()` from an UNFILTERED
 *        read of `business_config`, so only row 1 could ever pass the active
 *        check. Every other tenant received 403 before reaching the duplicate
 *        check, making the engine effectively single-tenant.
 *
 *   F10 - 01 - Lead Intake / `Append Customer Email Error` + `Append Owner Email Error`
 *        Both nodes received a fully built, sanitised error record but declared
 *        no column mapping, so the record was discarded and a blank `errors` row
 *        was appended instead.
 *
 *   F11 - 01 - Lead Intake / `Build Customer Email Error Record` + `Build Owner Email Error Record`
 *        Both builders routed business_id, lead_id and payload through
 *        `sanitize()` but interpolated `error_message` verbatim. Provider auth
 *        failures echo credentials, so secrets reached the `errors` tab. The
 *        existing pattern was gated behind `typeof v === 'object'`, so strings
 *        were never redacted; the fix reuses that pattern for the string branch
 *        and passes error_message through it.
 *
 * Every test drives the real workflow JSON and asserts on observed sheet rows and
 * on the engine's own declared contract, so they fail if a defect returns.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine } from '../src/engine.js';
import { newStore, engineOptions, WF, webhookInput, SECRET } from '../src/fixtures.js';
import { withClock } from '../src/clock.js';

const T0 = '2026-09-01T09:00:00.000Z';

const intakeBody = (over = {}) => ({
  business_id: 'biz_lonestar_hvac',
  source_type: 'web_form',
  source_id: 'f1-f5-fixture',
  name: 'Jordan Ellis',
  phone: '5125550188',
  email: 'jordan.ellis@example.com',
  message: 'No heat since last night, need a quote.',
  service: 'HVAC',
  city: 'Austin',
  state: 'TX',
  zip: '78704',
  urgency: 'normal',
  ...over
});

function runIntake(store, body = intakeBody(), at = T0, opts = {}) {
  return withClock(at, () => {
    const eng = new Engine(
      WF.intake(),
      engineOptions(store, { now: () => new Date(at).getTime(), ...opts })
    );
    eng.runAll(webhookInput(body));
    return eng;
  });
}

function runStatus(store, body, at = T0) {
  return withClock(at, () => {
    const eng = new Engine(
      WF.status(),
      engineOptions(store, { now: () => new Date(at).getTime() })
    );
    eng.runAll(webhookInput(body));
    return eng;
  });
}

/* ------------------------------------------------------------------ *
 * F1
 * ------------------------------------------------------------------ */

test('F1: intake sends the customer acknowledgment email', () => {
  const store = newStore();
  const eng = runIntake(store);

  const customer = eng.outbox.filter((e) => e.to === 'jordan.ellis@example.com');
  assert.equal(customer.length, 1, 'expected exactly one customer acknowledgment');
  assert.equal(customer[0].sent, true);
  assert.match(customer[0].subject, /We received your request/);
});

test('F1: intake notifies the owner', () => {
  const store = newStore();
  const eng = runIntake(store);

  const owner = eng.outbox.filter((e) => e.to === 'owner@lonestarhvac.example.com');
  assert.equal(owner.length, 1, 'expected exactly one owner notification');
  assert.equal(owner[0].sent, true);
  assert.match(owner[0].subject, /New normal lead \(score 80\)/);
});

test('F1: the customer email body is fully rendered, with no undefined', () => {
  const store = newStore();
  const eng = runIntake(store);
  const body = eng.outbox.find((e) => e.to === 'jordan.ellis@example.com').body;

  assert.doesNotMatch(body, /undefined/, 'email body rendered undefined');
  assert.match(body, /Jordan Ellis/);
  assert.match(body, /Lone Star HVAC &amp; Cooling/);
  assert.match(body, /book\.lonestarhvac\.example\.com/);
});

test('F1: the customer email carries the config from-address and reply-to', () => {
  const store = newStore();
  const eng = runIntake(store);
  const mail = eng.outbox.find((e) => e.to === 'jordan.ellis@example.com');

  assert.equal(mail.from, 'no-reply@lonestarhvac.example.com');
  assert.equal(mail.replyTo, 'hello@lonestarhvac.example.com');
});

test('F1: booking_link_sent is set once the acknowledgment is prepared', () => {
  const store = newStore();
  runIntake(store);

  const lead = store.rows('leads').find((r) => r.source_id === 'f1-f5-fixture');
  assert.equal(lead.booking_link_sent, 'TRUE');
  assert.equal(lead.booking_link, `https://book.lonestarhvac.example.com/?lead_id=${lead.lead_id}`);
});


test('F1: the owner-email gate still skips the owner branch when owner_email is blank', () => {
  // biz_v43_e03_no_owner is a seeded tenant (not row 1) with no owner_email.
  // F9 must resolve it by business_id, not by position.
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: 'biz_v43_e03_no_owner', source_id: 'f1-no-owner' }));

  assert.equal(eng.responses[0].code, 200, 'the lead must still be accepted');
  const owner = eng.outbox.filter((e) => e.to === 'owner@e03.example.com');
  assert.equal(owner.length, 0, 'must not send owner mail with no owner_email');
  const customer = eng.outbox.filter((e) => e.to === 'jordan.ellis@example.com');
  assert.equal(customer.length, 1, 'customer mail is still expected');
});

test('F1: a blank from_email suppresses both email branches, as the IF nodes define', () => {
  // `Owner Email Present?` and `Customer Email Present?` both require
  // `_fromEmailPresent`, so a tenant with no from_email sends neither.
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: 'biz_v43_e02_owner_no_from', source_id: 'f1-no-from' }));

  assert.equal(eng.responses[0].code, 200, 'the lead must still be accepted');
  assert.equal(eng.outbox.filter((e) => e.to === 'jordan.ellis@example.com').length, 0);
  assert.equal(eng.outbox.filter((e) => e.to === 'owner@e02.example.com').length, 0);
});

test('F1: the duplicate branch still returns 200 and still sends no email', () => {
  const store = newStore();
  runIntake(store);
  const eng = runIntake(store, intakeBody(), '2026-09-01T09:05:00.000Z');

  const dup = eng.responses[0];
  assert.equal(dup.code, 200);
  assert.match(dup.body, /duplicate/);
  assert.equal(eng.outbox.length, 0, 'a duplicate must not re-send email');
});

test('F1: the intake response contract is unchanged', () => {
  const store = newStore();
  const eng = runIntake(store);
  const res = eng.responses[0];

  assert.equal(res.code, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'created');
  assert.equal(body.score, 80);
  assert.equal(body.urgency, 'normal');
  assert.ok(body.lead_id.startsWith('lead_'));
});

/* ------------------------------------------------------------------ *
 * F10 - both email-error appends discarded the record they were given
 * ------------------------------------------------------------------ */

const ERROR_COLS = [
  'error_id',
  'created_at',
  'workflow',
  'node',
  'business_id',
  'lead_id',
  'error_message',
  'execution_id',
  'payload',
  'resolved'
];

/** Assert the row carries the whole record, not a blank shell. */
function assertPopulatedErrorRow(row, { node, prefix, messageFragment }) {
  for (const col of ERROR_COLS) {
    assert.ok(col in row, `errors row is missing the ${col} column`);
    assert.notEqual(row[col], '', `errors.${col} must not be blank`);
  }
  assert.equal(row.workflow, '01 - Lead Intake');
  assert.equal(row.node, node);
  assert.equal(row.business_id, 'biz_lonestar_hvac');
  assert.match(row.error_id, /^err_/);
  assert.match(row.execution_id, /^exec_/);
  assert.equal(row.resolved, 'false');
  assert.match(row.error_message, new RegExp(`^${prefix}:`));
  assert.ok(
    row.error_message.includes(messageFragment),
    `expected the provider message in errors.error_message, got ${JSON.stringify(row.error_message)}`
  );
  assert.deepEqual(JSON.parse(row.payload), {
    lead_id: row.lead_id,
    business_id: 'biz_lonestar_hvac'
  });
}

test('F10: a failed customer email writes a fully populated errors row', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f10-customer' }), T0, {
    emailFault: (spec) =>
      spec.node === 'Customer Acknowledgment' ? new Error('smtp refused 421') : null
  });

  assert.ok(
    eng.trace.some((t) => t.node === 'Build Customer Email Error Record'),
    'the record builder must run'
  );
  const errs = store.rows('errors');
  assert.equal(errs.length, 1, 'expected exactly one errors row');
  assertPopulatedErrorRow(errs[0], {
    node: 'Customer Acknowledgment',
    prefix: 'customer_email_failed',
    messageFragment: 'smtp refused 421'
  });
});

test('F10: a failed owner email writes a fully populated errors row', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f10-owner' }), T0, {
    emailFault: (spec) => (spec.node === 'Owner Notification' ? new Error('owner smtp refused 550') : null)
  });

  assert.ok(
    eng.trace.some((t) => t.node === 'Build Owner Email Error Record'),
    'the record builder must run'
  );
  const errs = store.rows('errors');
  assert.equal(errs.length, 1, 'expected exactly one errors row');
  assertPopulatedErrorRow(errs[0], {
    node: 'Owner Notification',
    prefix: 'owner_email_failed',
    messageFragment: 'owner smtp refused 550'
  });
});

test('F10: no tenant or engine secret reaches the errors row', () => {
  const store = newStore();
  runIntake(store, intakeBody({ source_id: 'f10-redact' }), T0, {
    emailFault: (spec) =>
      spec.node === 'Customer Acknowledgment' ? new Error('smtp refused 421') : null
  });

  const row = store.rows('errors')[0];
  const flat = JSON.stringify(row);
  // The tenant's business_secret and the shared webhook secret are both in
  // scope for the builders' sanitize(); neither may be persisted.
  assert.doesNotMatch(flat, /change-me-hvac-secret/, 'tenant business_secret leaked into errors');
  assert.doesNotMatch(flat, new RegExp(SECRET), 'webhook secret leaked into errors');
  // The sanitiser must survive the round trip, so the payload is readable JSON.
  assert.doesNotThrow(() => JSON.parse(row.payload));
});

test('F10: the successful email path is unchanged and still writes no errors row', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f10-success' }));

  assert.equal(eng.responses[0].code, 200);
  assert.equal(eng.outbox.length, 2);
  assert.equal(eng.outbox.filter((e) => e.sent).length, 2, 'both emails must still send');
  assert.equal(store.rows('errors').length, 0, 'a success must never write an errors row');

  const lead = store.rows('leads').find((r) => r.source_id === 'f10-success');
  assert.equal(lead.booking_link_sent, 'TRUE');
});

test('F10: error handling stays fail-safe - the lead survives, and the other branch still sends', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f10-failsafe' }), T0, {
    emailFault: (spec) =>
      spec.node === 'Customer Acknowledgment' ? new Error('smtp refused 421') : null
  });

  // The lead is still accepted and persisted.
  assert.equal(eng.responses[0].code, 200, 'an email failure must not fail the intake');
  const lead = store.rows('leads').find((r) => r.source_id === 'f10-failsafe');
  assert.ok(lead, 'the lead must still be written');
  assert.equal(lead.business_id, 'biz_lonestar_hvac');

  // The independent owner branch is unaffected.
  const owner = eng.outbox.find((e) => e.to === 'owner@lonestarhvac.example.com');
  assert.equal(owner.sent, true, 'the owner branch must still send');

  // booking_link_sent stays false: the link was never delivered.
  assert.equal(lead.booking_link_sent, 'false', 'a failed send must not mark the link as sent');
});

/* ------------------------------------------------------------------ *
 * F11 - error_message bypassed sanitize(), leaking provider secrets
 * ------------------------------------------------------------------ */

/**
 * Both error builders passed `business_id`, `lead_id` and `payload` through
 * `sanitize()`, but `error_message` interpolated the provider message verbatim.
 * SMTP and provider auth failures routinely echo credentials in that text, so
 * this was a live secret-leak path into the `errors` tab.
 *
 * The existing `sanitize()` already carried the right pattern
 * (secret|token|password|api[_ -]?key|authorization|bearer) but gated it behind
 * `typeof v === 'object'`, so a plain string - which is what an error message
 * always is - passed through untouched. The fix reuses that same pattern for the
 * string branch and routes `error_message` through it. No new mechanism.
 *
 * KNOWN LIMITATION, deliberately not addressed here: the shared pattern treats
 * the first token after `:`/`=` as the secret, so `Authorization: Bearer <jwt>`
 * redacts the word "Bearer" and leaves the JWT. That limit is pre-existing and
 * shared with the `payload` field and with 06 - Error Handler, so tightening it
 * means changing the pattern in all three places at once. Tracked as F11b.
 */

/** The sanitizer patterns the shared regex is expected to honour. */
const SANITIZER_PATTERNS = [
  ['api_key=LEAKED_API_KEY_123', 'LEAKED_API_KEY_123'],
  ['api-key = LEAKY_KEY_2', 'LEAKY_KEY_2'],
  ['X-Api-Key: LEAKY_KEY_3', 'LEAKY_KEY_3'],
  ['client_secret=SECRETVALUE_4', 'SECRETVALUE_4'],
  ['token=TOKENVALUE_5', 'TOKENVALUE_5'],
  ['password=PASSWORDVALUE_6', 'PASSWORDVALUE_6'],
  ['Authorization: AUTHVALUE_7', 'AUTHVALUE_7'],
  ['bearer: BEARERVALUE_8', 'BEARERVALUE_8']
];

/** Errors that carry no secret and must survive intact and readable. */
const ORDINARY_ERRORS = [
  '535 authentication failed for user bob@example.com',
  'smtp refused 421 connection closed by peer',
  'ECONNREFUSED 10.0.0.25:587'
];

function failingIntake(sourceId, message, node = 'Customer Acknowledgment') {
  const store = newStore();
  runIntake(store, intakeBody({ source_id: sourceId }), T0, {
    emailFault: (spec) => (spec.node === node ? new Error(message) : null)
  });
  return store;
}

test('F11: an API-key-like secret in the provider error is NOT persisted', () => {
  const store = failingIntake('f11-apikey', '535 authentication failed api_key=LEAKED_API_KEY_123');
  const row = store.rows('errors')[0];

  assert.ok(row, 'the failure must still be recorded');
  assert.doesNotMatch(
    row.error_message,
    /LEAKED_API_KEY_123/,
    'the secret must not reach the errors sheet'
  );
  // The useful part of the message survives, so the row is still actionable.
  assert.match(row.error_message, /^customer_email_failed: 535 authentication failed/);
  assert.match(row.error_message, /api_key=\[REDACTED\]/);
  // And the field the sanitiser always protected is still protected.
  assert.doesNotMatch(row.payload, /LEAKED_API_KEY_123/);
});

test('F11: every sanitizer pattern the implementation supports is redacted', () => {
  for (const [i, [message, secret]] of SANITIZER_PATTERNS.entries()) {
    const store = failingIntake(`f11-pattern-${i}`, message);
    const row = store.rows('errors')[0];
    assert.ok(row, `no errors row for pattern ${i} (${message})`);
    assert.doesNotMatch(
      row.error_message,
      new RegExp(secret),
      `secret ${secret} leaked from "${message}"`
    );
    assert.match(row.error_message, /\[REDACTED\]/, `no redaction marker for "${message}"`);
  }
});

test('F11: an ordinary provider error is preserved verbatim and stays useful', () => {
  for (const [i, message] of ORDINARY_ERRORS.entries()) {
    const store = failingIntake(`f11-ordinary-${i}`, message);
    const row = store.rows('errors')[0];
    assert.ok(row, `no errors row for ordinary error ${i}`);
    assert.ok(
      row.error_message.includes(message),
      `ordinary error was mangled: expected "${message}" inside "${row.error_message}"`
    );
    assert.doesNotMatch(row.error_message, /\[REDACTED\]/, 'nothing should be redacted here');
  }
});

test('F11: the owner branch is redacted too, and all ten columns stay populated', () => {
  const store = failingIntake(
    'f11-owner',
    '535 authentication failed api_key=OWNER_LEAK_9',
    'Owner Notification'
  );
  const row = store.rows('errors')[0];

  assert.ok(row, 'the owner failure must be recorded');
  assert.equal(row.node, 'Owner Notification');
  assert.equal(row.workflow, '01 - Lead Intake');
  assert.doesNotMatch(row.error_message, /OWNER_LEAK_9/, 'the owner secret must not be persisted');
  assert.match(row.error_message, /^owner_email_failed: 535 authentication failed/);

  // F10 must not regress: the row is a full record, not a blank one.
  for (const col of [
    'error_id',
    'created_at',
    'workflow',
    'node',
    'business_id',
    'lead_id',
    'error_message',
    'execution_id',
    'payload',
    'resolved'
  ]) {
    assert.ok(
      String(row[col] ?? '').length > 0,
      `column ${col} must stay populated (got ${JSON.stringify(row[col])})`
    );
  }
  assert.equal(row.business_id, 'biz_lonestar_hvac');
  assert.equal(row.lead_id, store.rows('leads').find((l) => l.source_id === 'f11-owner').lead_id);
});

test('F11: a successful send still writes no error row', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f11-success' }), T0);

  assert.equal(eng.outbox.filter((e) => e.sent).length, 2, 'both emails must still send');
  assert.equal(store.rows('errors').length, 0, 'success must never write an errors row');
});

test('F11: error handling is still fail-safe - the lead survives and redaction does not break the row', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f11-failsafe' }), T0, {
    emailFault: (spec) =>
      spec.node === 'Customer Acknowledgment'
        ? new Error('smtp refused 421 api_key=LEAKED_API_KEY_123')
        : null
  });

  // A redacted failure must not escalate into a failed intake.
  assert.equal(eng.responses[0].code, 200, 'an email failure must not fail the intake');

  const lead = store.rows('leads').find((l) => l.source_id === 'f11-failsafe');
  assert.ok(lead, 'the lead must still be written');
  assert.equal(lead.business_id, 'biz_lonestar_hvac');

  // The independent owner branch is unaffected.
  const owner = eng.outbox.find((e) => e.to === 'owner@lonestarhvac.example.com');
  assert.equal(owner.sent, true, 'the owner branch must still send');
  // The link was never delivered, so it must not be marked sent.
  assert.equal(lead.booking_link_sent, 'false', 'a failed send must not mark the link as sent');

  const row = store.rows('errors')[0];
  assert.ok(row, 'the failure must be recorded');
  assert.doesNotMatch(row.error_message, /LEAKED_API_KEY_123/);
  assert.match(row.error_message, /smtp refused 421/);
  assert.equal(row.resolved, 'false');
});

/* ------------------------------------------------------------------ *
 * F12 - booking_link_sent was stamped TRUE even with no booking link
 * ------------------------------------------------------------------ */

/**
 * CONTRACT (established before changing anything, and asserted below):
 *
 * 1. A booking link is VALID only if it survives `safeBookingLink()` in
 *    `Resolve Config & Normalize Lead`: non-empty, https-only, no control or
 *    dangerous characters, and carrying lead_id attribution. That function
 *    returns '' for anything else, and the node also records the truthiness of
 *    the validated result as `_bookingLinkPresent`.
 *
 * 2. An absent link must NOT suppress the customer acknowledgment. That email
 *    confirms the inquiry was received; `Customer Email Present?` gates on
 *    `email` and `_fromEmailPresent` only. Withholding it from a tenant that
 *    simply has not configured a link would silently drop customer
 *    confirmations, which is a redesign, not a fix.
 *
 * 3. `booking_link_sent` means "the booking link was delivered". `Append Lead`
 *    seeds it `false`; `Update Booking Link` is the only writer. With no link
 *    nothing was delivered, so TRUE is a false positive and the over-counts
 *    every tenant measurement of link delivery. THIS WAS THE DEFECT.
 *
 * 4. An absent link must NOT write an `errors` row. Not configuring a booking
 *    link is a legitimate tenant configuration, not an execution failure, and
 *    `errors` is the failure ledger - the same ledger F10 made trustworthy and
 *    F11 made safe. A config gap recorded per lead would corrupt it.
 *
 * 5. The validation pattern already existed and was simply not wired:
 *    `_bookingLinkPresent` is computed in `Resolve Config & Normalize Lead` (and
 *    in 03 - Manual Callback Log) but consumed by no node in any workflow. The
 *    fix reuses it rather than adding a check or a new node.
 *
 * The customer email body already guarded itself correctly - the "book online"
 * paragraph is interpolated as `${$json.booking_link ? ... : ''}` - so no email
 * template change was needed. Test 3 below locks that behaviour in.
 */

const LINK_TENANT = 'biz_lonestar_hvac'; // config.booking_link is a real https URL
const NO_LINK_TENANT = 'biz_hillcountry_plumbing'; // config.booking_link is ''

const tenantBody = (businessId, sourceId) =>
  intakeBody({ business_id: businessId, source_id: sourceId });

test('F12: a valid booking link still records delivery as TRUE (no regression)', () => {
  const store = newStore();
  runIntake(store, tenantBody(LINK_TENANT, 'f12-valid-link'), T0);

  const lead = store.rows('leads').find((l) => l.source_id === 'f12-valid-link');
  assert.ok(lead, 'the lead must be written');

  // The link was validated, stored, and delivered.
  assert.match(lead.booking_link, /^https:\/\/book\.lonestarhvac\.example\.com\//);
  assert.match(lead.booking_link, /lead_id=/, 'safeBookingLink must still attribute the lead');
  assert.equal(lead.booking_link_sent, 'TRUE', 'a real link that was sent must stay TRUE');
});

test('F12: a tenant with no configured booking link records a TRUTHFUL booking_link_sent', () => {
  const store = newStore();
  runIntake(store, tenantBody(NO_LINK_TENANT, 'f12-empty-link'), T0);

  const lead = store.rows('leads').find((l) => l.source_id === 'f12-empty-link');
  assert.ok(lead, 'the lead must be written');
  assert.equal(lead.business_id, NO_LINK_TENANT);
  assert.equal(lead.booking_link, '', 'this tenant genuinely has no link');

  // THE FIX: nothing was delivered, so the flag must not claim it was.
  assert.notEqual(
    lead.booking_link_sent,
    'TRUE',
    'booking_link_sent must not be TRUE when no booking link exists'
  );
  assert.equal(lead.booking_link_sent, 'false');

  // The invariant the measurement layer depends on: sent <=> a link exists.
  assert.equal(lead.booking_link_sent === 'TRUE', lead.booking_link.length > 0);
});

test('F12: the customer email is not suppressed, and its body implies no usable link', () => {
  const store = newStore();
  const eng = runIntake(store, tenantBody(NO_LINK_TENANT, 'f12-no-link-body'), T0);

  const customer = eng.outbox.find((e) => e.to === 'jordan.ellis@example.com');
  assert.ok(customer, 'the acknowledgment must still be delivered');
  assert.equal(customer.sent, true, 'an absent link must not suppress the acknowledgment');

  const html = customer.html ?? customer.body ?? '';
  // The acknowledgment itself is intact.
  assert.match(html, /Thanks for contacting/);
  assert.match(html, /Hill Country Plumbing/);
  // But it promises nothing the tenant cannot honour.
  assert.doesNotMatch(html, /book online/i, 'no booking CTA when there is no link');
  assert.doesNotMatch(html, /Schedule here/i, 'no booking CTA when there is no link');
  assert.doesNotMatch(html, /<a\s+href/i, 'no dangling anchor when there is no link');
  assert.doesNotMatch(html, /lonestarhvac\.example\.com/, 'no cross-tenant link leakage');
});

test('F12: unrelated email and intake behaviour is unchanged, and no error is invented', () => {
  const store = newStore();
  const eng = runIntake(store, tenantBody(NO_LINK_TENANT, 'f12-unrelated'), T0);

  // Intake still succeeds.
  assert.equal(eng.responses[0].code, 200);

  // Both emails still send, from the right tenant.
  const customer = eng.outbox.find((e) => e.to === 'jordan.ellis@example.com');
  const owner = eng.outbox.find((e) => e.to === 'owner@hillcountryplumbing.example.com');
  assert.equal(customer.sent, true, 'the customer branch is unaffected');
  assert.equal(owner.sent, true, 'the owner branch is unaffected');
  assert.equal(customer.from, 'no-reply@hillcountryplumbing.example.com');

  // Contract 4: a config gap is not an execution failure.
  assert.equal(
    store.rows('errors').length,
    0,
    'a missing booking link must not write an errors row'
  );

  // The rest of the lead record is intact.
  const lead = store.rows('leads').find((l) => l.source_id === 'f12-unrelated');
  assert.equal(lead.status, 'new');
  assert.equal(lead.score, lead.score); // populated, not NaN/undefined
  assert.ok(Number(lead.score) > 0);
  assert.equal(store.rows('leads').filter((l) => l.source_id === 'f12-unrelated').length, 1);
});

/* ------------------------------------------------------------------ *
 * F12 - node count and graph must be untouched by the fix
 * ------------------------------------------------------------------ */

test('F12: the fix changed one expression, not the graph', () => {
  // Assert against the raw on-disk workflow text, not the engine's in-memory
  // view, so this can never be satisfied by a projected or mutated copy.
  const wf = JSON.parse(WF.intake().__raw);
  assert.equal(wf.nodes.length, 31, 'F12 must not add or remove nodes');

  const node = wf.nodes.find((n) => n.name === 'Update Booking Link');
  assert.ok(node, 'Update Booking Link must still exist');
  assert.equal(node.parameters.operation, 'update');
  assert.equal(node.parameters.columns.mappingMode, 'defineBelow');
  assert.deepEqual(node.parameters.columns.matchingColumns, ['lead_id']);
  assert.deepEqual(
    Object.keys(node.parameters.columns.value),
    ['lead_id', 'booking_link_sent'],
    'the update must still write exactly lead_id + booking_link_sent'
  );

  // The write is now conditional, and reads the pre-existing validation flag.
  const expr = node.parameters.columns.value.booking_link_sent;
  assert.match(expr, /_bookingLinkPresent/, 'must reuse the existing flag');
  assert.match(expr, /'TRUE'\s*:\s*'false'/, 'must yield a truthful sheet value');

  // `Prepare Email Content` is the node F1 established as the authoritative
  // source for the lead fields the email branch consumes.
  assert.equal(node.parameters.columns.value.lead_id, "={{ $('Customer Email Present?').first().json.lead_id }}");

  // The graph edges into and out of the node must be untouched.
  const main = wf.connections['Customer Acknowledgment'].main;
  assert.ok(
    main.some((branch) => branch.some((c) => c.node === 'Update Booking Link')),
    'the node must still hang off the customer-email success branch'
  );
});

/* ------------------------------------------------------------------ *
 * F13 - 06 - Error Handler persisted error_message unsanitised
 *
 * WF06 is the error workflow for 01-05 and 07, so its `errors` row and its
 * admin email are the last stop for every failure in the engine. Unlike the two
 * WF01 builders, its `sanitize()` only redacted the `typeof v === 'object'`
 * branch and returned strings verbatim - and `error_message` was never passed
 * through it at all. Provider auth failures echo credentials, so any secret in a
 * failure message was written verbatim to the shared `errors` tab and emailed
 * to the admin address.
 *
 * The fix hoists the shared regex to a `SECRET_RE` const, gives the string
 * branch the same redaction the object branch already had, and routes
 * `error_message` through `sanitize()`. The 2000-character slice, the
 * `error_id`, the attribution fields, the payload capture and the notification
 * wiring are all left exactly as they were.
 * ------------------------------------------------------------------ */

/** A realistic JWT: three dot-separated base64url segments. */
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/** Drive WF06 with the payload shape n8n hands an error workflow. */
function runErrorWorkflow(message, at = T0) {
  const store = newStore();
  const payload = {
    execution: {
      id: 'exec_9001',
      url: 'https://n8n.example.com/workflow/SALWX4B52TcMFKWP/executions/9001',
      error: { message, name: 'Error', level: 'error' },
      lastNodeExecuted: 'Customer Acknowledgment',
      mode: 'webhook'
    },
    workflow: { id: 'SALWX4B52TcMFKWP', name: '01 - Lead Intake' }
  };
  const eng = withClock(at, () => {
    const e = new Engine(
      WF.errorHandler(),
      engineOptions(store, { now: () => new Date(at).getTime() })
    );
    e.runAll(payload);
    return e;
  });
  return { store, eng };
}

test('F13 A: an ordinary error message is still recorded, in full and readable', () => {
  for (const message of ORDINARY_ERRORS) {
    const { store } = runErrorWorkflow(message);
    const row = store.rows('errors')[0];
    assert.ok(row, `no errors row for "${message}"`);
    assert.equal(row.error_message, message, 'an ordinary message must survive verbatim');
  }
});

test('F13 B: an API-key-like secret in the failure is NOT persisted', () => {
  const { store } = runErrorWorkflow('SMTP rejected the request: api_key=LEAKED_API_KEY_123');
  const row = store.rows('errors')[0];

  assert.ok(row, 'the failure must still be recorded');
  assert.doesNotMatch(row.error_message, /LEAKED_API_KEY_123/, 'the secret must not reach the errors sheet');
  // The useful part of the message survives, so the row is still actionable.
  assert.equal(row.error_message, 'SMTP rejected the request: api_key=[REDACTED]');
});

test('F13 C: a bearer credential is FULLY redacted in every realistic shape', () => {
  const shapes = [
    [`SMTP rejected: Authorization: Bearer ${JWT}`, 'SMTP rejected: Authorization: [REDACTED]'],
    [`SMTP rejected: Bearer ${JWT}`, 'SMTP rejected: Bearer [REDACTED]'],
    [`SMTP rejected: bearer ${JWT}`, 'SMTP rejected: bearer [REDACTED]'],
    [`SMTP rejected: bearer: ${JWT}`, 'SMTP rejected: bearer: [REDACTED]'],
    [`SMTP rejected: Authorization:${JWT}`, 'SMTP rejected: Authorization:[REDACTED]'],
    [`SMTP rejected: token=${JWT}`, 'SMTP rejected: token=[REDACTED]'],
    ['SMTP rejected: token=' + JWT, 'SMTP rejected: token=[REDACTED]']
  ];
  for (const [message, expected] of shapes) {
    const { store } = runErrorWorkflow(message);
    const row = store.rows('errors')[0];
    assert.ok(row, `no errors row for: ${message.slice(0, 48)}`);
    // The whole credential goes, not just the scheme word in front of it.
    assert.equal(row.error_message, expected, `wrong output for: ${message.slice(0, 48)}`);
    assert.doesNotMatch(row.error_message, /eyJhbGciOi/, 'the JWT header survived');
    assert.doesNotMatch(row.error_message, /SflKxwRJ/, 'the JWT signature survived');
  }
});

test('F13 C2: malformed and short bearer values are redacted, a bare keyword is not', () => {
  const cases = [
    ['Bearer SUPERSECRETTOKEN', 'Bearer [REDACTED]'],
    ['Bearer x', 'Bearer [REDACTED]'],
    ['Bearer abc.def', 'Bearer [REDACTED]'],
    ['bearer tok', 'bearer [REDACTED]'],
    ['bearer: tok_9', 'bearer: [REDACTED]'],
    ['Authorization: Bearer', 'Authorization: [REDACTED]'],
    ['bearer\tTABVALUE', 'bearer\t[REDACTED]'],
    // A keyword with no value is not a secret and must not gain a marker.
    ['Bearer', 'Bearer'],
    ['Unauthorized', 'Unauthorized']
  ];
  for (const [message, expected] of cases) {
    const { store } = runErrorWorkflow(message);
    const row = store.rows('errors')[0];
    assert.ok(row, `no errors row for ${JSON.stringify(message)}`);
    assert.equal(row.error_message, expected, `wrong output for ${JSON.stringify(message)}`);
  }
});

test('F13 C3: an API-key prefix is still a secret, but ordinary prose is not mangled', () => {
  const { store } = runErrorWorkflow('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25 token=\u4ee4\u724c_ABC123');
  assert.equal(
    store.rows('errors')[0].error_message,
    '\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25 token=[REDACTED]',
    'a non-ASCII secret is redacted and the surrounding text is untouched'
  );

  // Neither of these carries a secret, so both must survive byte-for-byte.
  for (const message of [
    'payment failed code=401 provider=resend',
    'list sort=failed arg=--size=10',
    'size=10 sort=name',
    'provider said {"error":"invalid"} code=401'
  ]) {
    const row = runErrorWorkflow(message).store.rows('errors')[0];
    assert.equal(row.error_message, message, `ordinary text was altered: ${message}`);
  }
});

test('F13 D: the populated error record still carries every expected field', () => {
  const { store, eng } = runErrorWorkflow('Customer email failed: 535 authentication failed');
  const row = store.rows('errors')[0];

  assert.ok(row, 'an errors row must be written');
  for (const col of ERROR_COLS) {
    assert.ok(col in row, `errors row is missing the ${col} column`);
  }
  assert.match(row.error_id, /^err_\d+_[a-z0-9]{6}$/, 'error_id generation is unchanged');
  assert.equal(row.created_at, new Date(T0).toISOString(), 'created_at is unchanged');
  assert.equal(row.workflow, '01 - Lead Intake', 'workflow attribution is unchanged');
  assert.equal(row.node, 'Customer Acknowledgment', 'node attribution is unchanged');
  assert.equal(row.business_id, '', 'WF06 wrote no business_id before and still does not');
  assert.equal(row.lead_id, '', 'WF06 wrote no lead_id before and still does not');
  assert.equal(row.execution_id, 'exec_9001', 'execution attribution is unchanged');
  assert.equal(row.resolved, 'false', 'resolved behaviour is unchanged');
  assert.ok(row.payload.length > 0, 'the payload is still captured');

  // The graph is still trigger -> build -> append -> notify. (The engine
  // records a trigger twice, once in runAll and once in runNode, so compare
  // the de-duplicated sequence rather than the raw trace.)
  const seen = eng.trace.map((t) => t.node).filter((n, i, all) => n !== all[i - 1]);
  assert.deepEqual(seen, [
    'When an Error Occurs',
    'Build & Sanitize Error Record',
    'Append Error',
    'Admin Error Notification'
  ]);
});

test('F13 E: the payload is still sanitised, and the 2000-char slice is unchanged', () => {
  const { store } = runErrorWorkflow(
    'lead capture failed: api_key=LEAKED_API_KEY_123 while reading business_config'
  );
  const row = store.rows('errors')[0];
  assert.ok(row);

  // The object branch of sanitize() still guards the payload.
  assert.doesNotMatch(row.payload, /LEAKED_API_KEY_123/, 'the payload must stay sanitised');
  assert.equal(
    row.error_message,
    'lead capture failed: api_key=[REDACTED] while reading business_config'
  );

  // An over-long message is still truncated, and redaction still applies.
  const long = `api_key=HEAD_SECRET_1 ${'y'.repeat(3000)}`;
  const cut = runErrorWorkflow(long).store.rows('errors')[0];
  assert.equal(cut.error_message.length, 2000, 'the 2000-char slice is unchanged');
  assert.doesNotMatch(cut.error_message, /HEAD_SECRET_1/, 'the secret must be redacted');
});

test('F13 F: the admin notification is still sent exactly once, to the same address', () => {
  const { eng } = runErrorWorkflow('Customer email failed: 535 authentication failed');
  assert.equal(eng.outbox.length, 1, 'exactly one admin notification');

  const mail = eng.outbox[0];
  assert.equal(mail.sent, true, 'the admin notification must still be sent');
  assert.equal(mail.to, 'ops@lead-recovery-engine.example.com', 'the recipient is unchanged');
  assert.match(mail.subject, /^Lead Recovery Engine/, 'the subject is unchanged');
  assert.match(mail.subject, /Workflow Error$/, 'the subject is unchanged');

  // And a secret reaches the admin only in redacted form.
  const secret = runErrorWorkflow('SMTP rejected: api_key=LEAKED_API_KEY_123').eng.outbox[0];
  assert.equal(secret.sent, true, 'the admin notification is still sent for a failing execution');
  assert.doesNotMatch(
    JSON.stringify(secret),
    /LEAKED_API_KEY_123/,
    'the admin email must not carry the secret'
  );
  assert.match(secret.html ?? secret.body ?? '', /api_key=\[REDACTED\]/, 'the admin sees the redacted form');
});

test('F13 G: persistence stays fail-safe when the message is missing or empty', () => {
  const missing = runErrorWorkflow(undefined).store.rows('errors')[0];
  assert.ok(missing, 'a row is written even with no message');
  assert.equal(missing.error_message, 'unknown error', 'the documented fallback is unchanged');

  const empty = runErrorWorkflow('').store.rows('errors')[0];
  assert.ok(empty, 'a row is written for an empty message');
  assert.equal(empty.error_message, 'unknown error', 'an empty message still falls back');
});

test('F13: the fix is confined to the one node', () => {
  // Assert against the raw on-disk text, so a projected copy cannot satisfy it.
  const wf = JSON.parse(WF.errorHandler().__raw);
  assert.equal(wf.nodes.length, 4, 'WF06 must still have exactly four nodes');

  const code = wf.nodes.find((n) => n.name === 'Build & Sanitize Error Record').parameters.jsCode;
  assert.match(code, /const SECRET_RE = /, 'the regex is hoisted to a shared const');
  assert.match(code, /const redactSecret = /, 'the shared replacer is used');
  assert.match(
    code,
    /const errorMessage = sanitize\([\s\S]*?\n\)\.slice\(0, 2000\);/,
    'error_message must be built through sanitize() and still sliced to 2000'
  );
  assert.match(code, /error_message: errorMessage/, 'the record still assigns error_message');

  // The schema, the id, the attribution and the payload are all untouched.
  assert.match(code, /'err_' \+\s*Date\.now\(\)/, 'error_id generation is untouched');
  assert.match(code, /payload: sanitize\(err\)\.slice\(0, 4000\)/, 'payload handling is untouched');
  assert.match(code, /resolved: false/, 'resolved behaviour is untouched');
  assert.deepEqual(
    wf.nodes
      .find((n) => n.name === 'Append Error')
      .parameters.fieldsUi.fieldValues.map((f) => f.fieldId),
    ERROR_COLS,
    'the errors-sheet column mapping is untouched'
  );
});

/* ------------------------------------------------------------------ *
 * F14 - the shared SECRET_RE left a bearer credential exposed
 *
 * The old pattern matched `authorization` first and its value group stopped at
 * the first whitespace, so it captured the single word `Bearer` and left the
 * JWT behind: `Authorization: Bearer <jwt>` became
 * `Authorization: [REDACTED] <jwt>`. A bare `Bearer <jwt>`, which has no
 * `:` or `=` after the keyword, matched nothing at all and survived whole.
 *
 * The fix adds a leading branch for a bare bearer credential and lets the value
 * group itself be `Bearer <credential>`. Because SECRET_RE is textually
 * duplicated in three Code nodes, every consumer is exercised below.
 * ------------------------------------------------------------------ */

/**
 * Every Code node in the engine that owns a copy of the shared sanitizer, with
 * the way to provoke it and the label it stamps on the message. WF01 prefixes
 * the provider message; WF06 stores it bare.
 */
const CONSUMERS = [
  {
    label: 'WF01 customer email',
    loader: WF.intake,
    node: 'Build Customer Email Error Record',
    branchNode: 'Customer Acknowledgment',
    prefix: 'customer_email_failed: '
  },
  {
    label: 'WF01 owner email',
    loader: WF.intake,
    node: 'Build Owner Email Error Record',
    branchNode: 'Owner Notification',
    prefix: 'owner_email_failed: '
  },
  {
    label: 'WF06 error handler',
    loader: WF.errorHandler,
    node: 'Build & Sanitize Error Record',
    branchNode: null,
    prefix: ''
  }
];

let consumerSeq = 0;

/** The error_message a given consumer persists for `message`. */
function errorMessageFrom(consumer, message) {
  const store = consumer.branchNode
    ? failingIntake(`f14-${++consumerSeq}`, message, consumer.branchNode)
    : runErrorWorkflow(message).store;
  const row = store.rows('errors')[0];
  assert.ok(row, `${consumer.label} wrote no errors row for: ${message.slice(0, 48)}`);
  return row.error_message;
}

/** The SECRET_RE + redactSecret source of a consumer, for a drift check. */
function sanitizerRegionOf(consumer) {
  const code = consumer.loader().nodes.find((n) => n.name === consumer.node).parameters.jsCode;
  // Trimmed: WF01 and WF06 differ only in trailing blank lines here, and the
  // point of the check is that the sanitizer logic itself cannot drift.
  return code.slice(code.indexOf('const SECRET_RE'), code.indexOf('function sanitize')).trim();
}

test('F14: all three consumers share one identical SECRET_RE and replacer', () => {
  for (const c of CONSUMERS) {
    const region = sanitizerRegionOf(c);
    assert.match(region, /const SECRET_RE = /, `${c.label} has no hoisted SECRET_RE`);
    assert.match(region, /const redactSecret = /, `${c.label} has no shared replacer`);
    assert.doesNotMatch(region, /\$1\$2\[REDACTED\]/, `${c.label} still uses the old $1$2 replacer`);
  }
  // Guard against the three copies drifting apart again.
  const unique = new Set(CONSUMERS.map(sanitizerRegionOf));
  assert.equal(unique.size, 1, 'the SECRET_RE + redactSecret block must be identical in all three consumers');
});

test('F14: a realistic JWT is FULLY redacted by every consumer', () => {
  const shapes = [
    `provider auth failed: Authorization: Bearer ${JWT}`,
    `provider auth failed: Bearer ${JWT}`,
    'provider auth failed: bearer: ' + JWT,
    `provider auth failed: token=${JWT}`
  ];
  for (const c of CONSUMERS) {
    for (const message of shapes) {
      const text = errorMessageFrom(c, message);
      assert.doesNotMatch(text, /eyJhbGciOi/, `${c.label} leaked the JWT header: ${text.slice(0, 80)}`);
      assert.doesNotMatch(text, /SflKxwRJ/, `${c.label} leaked the JWT signature: ${text.slice(0, 80)}`);
      assert.match(text, /\[REDACTED\]/, `${c.label} produced no redaction marker: ${text.slice(0, 80)}`);
      assert.ok(
        text.startsWith(c.prefix + 'provider auth failed'),
        `${c.label} lost the context: ${text.slice(0, 80)}`
      );
    }
  }
});

test('F14: malformed and short bearer values are handled by every consumer', () => {
  const cases = [
    ['Bearer SUPERSECRETTOKEN', 'Bearer [REDACTED]'],
    ['Bearer x', 'Bearer [REDACTED]'],
    ['Bearer abc.def', 'Bearer [REDACTED]'],
    ['bearer tok', 'bearer [REDACTED]'],
    ['bearer: tok_9', 'bearer: [REDACTED]'],
    ['Authorization: Bearer', 'Authorization: [REDACTED]'],
    ['bearer\tTABVALUE', 'bearer\t[REDACTED]'],
    // A keyword with no value is not a secret.
    ['Bearer', 'Bearer'],
    ['Unauthorized', 'Unauthorized']
  ];
  for (const c of CONSUMERS) {
    for (const [message, expected] of cases) {
      assert.equal(
        errorMessageFrom(c, message),
        c.prefix + expected,
        `${c.label} mishandled ${JSON.stringify(message)}`
      );
    }
  }
});

test('F14: the pre-existing secret patterns still work in every consumer', () => {
  for (const c of CONSUMERS) {
    for (const [i, [message, secret]] of SANITIZER_PATTERNS.entries()) {
      const text = errorMessageFrom(c, message);
      assert.doesNotMatch(text, new RegExp(secret), `${c.label} regressed on pattern ${i} (${message}): ${text}`);
      assert.match(text, /\[REDACTED\]/, `${c.label} lost the marker on pattern ${i}`);
    }
  }
});

test('F14: ordinary error text is NOT over-redacted by any consumer', () => {
  const ordinary = [
    ...ORDINARY_ERRORS,
    'Customer email failed: 535 authentication failed',
    'The authorization process was delayed by 5 minutes',
    'Execution failed: node "Code in JavaScript" threw a TypeError',
    'Unauthorized',
    'payment failed code=401 provider=resend',
    'Workflow "05 - Follow-up Sweeper" not connected'
  ];
  for (const c of CONSUMERS) {
    for (const message of ordinary) {
      const text = errorMessageFrom(c, message);
      assert.equal(text, c.prefix + message, `${c.label} altered an ordinary message: ${text}`);
      assert.doesNotMatch(text, /\[REDACTED\]/, `${c.label} redacted nothing-worthy: ${message}`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * F9 - intake resolved business_config by position, not by tenant
 * ------------------------------------------------------------------ */

/** Row 2 of the seeded business_config tab, active, with its own addresses. */
const TENANT_1 = 'biz_lonestar_hvac';
const TENANT_2 = 'biz_hillcountry_plumbing';
const TENANT_INACTIVE = 'biz_deadwood_remodels';

test('F9: tenant 1 is still accepted (no regression on the original single row)', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ source_id: 'f9-t1' }));

  assert.equal(eng.responses[0].code, 200);
  assert.equal(eng.responses[0].node, 'Respond 200 Created');
  const lead = store.rows('leads').find((r) => r.source_id === 'f9-t1');
  assert.equal(lead.business_id, TENANT_1);
});

test('F9: tenant 2 is accepted - the lookup matches business_id, not row position', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: TENANT_2, source_id: 'f9-t2' }));

  assert.equal(eng.responses[0].code, 200, 'a valid second tenant must not be rejected');
  assert.equal(eng.responses[0].node, 'Respond 200 Created');

  const lead = store.rows('leads').find((r) => r.source_id === 'f9-t2');
  assert.ok(lead, 'the lead must be persisted under the second tenant');
  assert.equal(lead.business_id, TENANT_2);
  assert.equal(store.rows('errors').length, 0);
});

test('F9: tenant 2 cannot use tenant 1 configuration', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: TENANT_2, source_id: 'f9-iso' }));

  const owner = eng.outbox.find((e) => e.to === 'owner@hillcountryplumbing.example.com');
  const customer = eng.outbox.find((e) => e.to === 'jordan.ellis@example.com');
  assert.ok(owner && customer, 'both branches must run for the second tenant');
  assert.equal(owner.from, 'no-reply@hillcountryplumbing.example.com');
  assert.equal(customer.from, 'no-reply@hillcountryplumbing.example.com');
  assert.match(owner.body, /Hill Country Plumbing/, 'the body must name the second tenant');

  // Nothing may be addressed or sent from tenant 1.
  const crossTenant = eng.outbox.filter(
    (e) => /lonestarhvac/.test(e.to) || /lonestarhvac/.test(e.from) || /lonestarhvac/.test(e.replyTo)
  );
  assert.equal(crossTenant.length, 0, 'no tenant 1 address may appear on tenant 2 mail');
  for (const mail of eng.outbox) {
    assert.doesNotMatch(mail.subject + mail.body, /Lone Star/, 'no tenant 1 branding may leak');
  }
});

test('F9: an unknown tenant is still rejected with 403', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: 'biz_not_a_tenant', source_id: 'f9-unknown' }));

  assert.equal(eng.responses[0].code, 403);
  assert.equal(eng.responses[0].node, 'Respond 403 Invalid Business');
  assert.equal(eng.outbox.length, 0, 'no mail may be sent');
  assert.equal(store.rows('leads').filter((r) => r.source_id === 'f9-unknown').length, 0);
});

test('F9: an inactive tenant is still rejected with 403 - authorization is not broadened', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: TENANT_INACTIVE, source_id: 'f9-inactive' }));

  assert.equal(eng.responses[0].code, 403);
  assert.equal(eng.responses[0].node, 'Respond 403 Invalid Business');
  assert.equal(eng.outbox.length, 0, 'no mail may be sent');
  assert.equal(store.rows('leads').filter((r) => r.source_id === 'f9-inactive').length, 0);
});

test('F9: the match is exact - a prefix of a real business_id is still rejected', () => {
  const store = newStore();
  const eng = runIntake(store, intakeBody({ business_id: 'biz_hillcountry_plumb', source_id: 'f9-prefix' }));

  assert.equal(eng.responses[0].code, 403, 'a partial id must not resolve to a tenant');
  assert.equal(store.rows('leads').filter((r) => r.source_id === 'f9-prefix').length, 0);
});

/* ------------------------------------------------------------------ *
 * F5
 * ------------------------------------------------------------------ */

test('F5: a status transition records old_status, new_status and updated_by', () => {
  const store = newStore();
  const lead = store.rows('leads')[0];

  runStatus(store, {
    business_id: 'biz_lonestar_hvac',
    lead_id: lead.lead_id,
    new_status: 'lost',
    updated_by: 'front_desk',
    notes: 'Went with a competitor.'
  });

  const rows = store.rows('status_updates');
  assert.equal(rows.length, 1, 'expected exactly one status_updates row');
  assert.equal(rows[0].old_status, 'new');
  assert.equal(rows[0].new_status, 'lost');
  assert.equal(rows[0].updated_by, 'front_desk');
  assert.equal(rows[0].notes, 'Went with a competitor.');
  assert.equal(rows[0].lead_id, lead.lead_id);
  assert.equal(rows[0].business_id, 'biz_lonestar_hvac');
  assert.ok(rows[0].update_id.startsWith('upd_'));
  assert.ok(rows[0].created_at);
});

test('F5: every recorded transition is non-empty, across a multi-step sequence', () => {
  const store = newStore();
  const lead = store.rows('leads')[0];
  const bid = 'biz_lonestar_hvac';

  runStatus(store, { business_id: bid, lead_id: lead.lead_id, new_status: 'contacted', updated_by: 'ai' });
  runStatus(store, { business_id: bid, lead_id: lead.lead_id, new_status: 'qualified', updated_by: 'front_desk' });
  runStatus(store, { business_id: bid, lead_id: lead.lead_id, new_status: 'booked', booking_id: 'bk_1', booked_at: '2026-09-01T10:00:00.000Z' }, '2026-09-01T10:00:00.000Z');

  const rows = store.rows('status_updates');
  assert.equal(rows.length, 3);

  assert.deepEqual(
    rows.map((r) => [r.old_status, r.new_status, r.updated_by]),
    [
      ['new', 'contacted', 'ai'],
      ['contacted', 'qualified', 'front_desk'],
      ['qualified', 'booked', 'operator']
    ]
  );

  for (const r of rows) {
    assert.notEqual(r.old_status, '', 'old_status must never be blank');
    assert.notEqual(r.new_status, '', 'new_status must never be blank');
    assert.notEqual(r.updated_by, '', 'updated_by must never be blank');
  }
});

test('F5: a rejected transition still appends nothing and still returns 409', () => {
  const store = newStore();
  const lead = store.rows('leads')[0];
  const bid = 'biz_lonestar_hvac';

  runStatus(store, { business_id: bid, lead_id: lead.lead_id, new_status: 'lost' });
  const eng = runStatus(store, { business_id: bid, lead_id: lead.lead_id, new_status: 'qualified' });

  assert.equal(eng.responses[0].code, 409);
  assert.equal(store.rows('status_updates').length, 1, 'a rejected transition must not be recorded');
});

test('F5: an invalid status still returns 422 and records nothing', () => {
  const store = newStore();
  const lead = store.rows('leads')[0];

  const eng = runStatus(store, {
    business_id: 'biz_lonestar_hvac',
    lead_id: lead.lead_id,
    new_status: 'not_a_status'
  });

  assert.equal(eng.responses[0].code, 422);
  assert.equal(store.rows('status_updates').length, 0);
});

test('F5: the lead row and the 200 response are unchanged by the fix', () => {
  const store = newStore();
  const lead = store.rows('leads')[0];

  const eng = runStatus(store, {
    business_id: 'biz_lonestar_hvac',
    lead_id: lead.lead_id,
    new_status: 'qualified',
    updated_by: 'front_desk',
    notes: 'Quote sent'
  });

  const res = eng.responses[0];
  assert.equal(res.code, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'updated');
  assert.equal(body.new_status, 'qualified');

  const after = store.rows('leads').find((r) => r.lead_id === lead.lead_id);
  assert.equal(after.status, 'qualified');
  assert.equal(after.notes, 'Quote sent');
  assert.equal(after.booking_link, lead.booking_link, 'unrelated columns must be untouched');
});

void SECRET;
