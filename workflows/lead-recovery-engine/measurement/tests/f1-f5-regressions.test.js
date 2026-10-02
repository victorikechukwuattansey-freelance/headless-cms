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
import { createHash } from 'node:crypto';

import { Engine } from '../src/engine.js';
import { newStore, engineOptions, WF, webhookInput, scheduleInput, SECRET } from '../src/fixtures.js';
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
 * F15 - a quoted secret reached the errors sheet
 * ------------------------------------------------------------------ *
 *
 * The shared value group was `[^,}"'\s]+`: it stopped dead on `"`, `'` and a
 * backtick, so a provider that quoted its secret defeated the sanitizer
 * completely. `api_key="SECRET"` and `{"api_key":"SECRET"}` both persisted the
 * credential verbatim - the quote became the boundary the value could not
 * cross, and the *whole* secret survived.
 *
 * The fix teaches the value group the three quoted-literal shapes, and makes
 * `redactSecret` re-emit the quote it found so a JSON payload stays
 * well-formed. `Bearer <credential>` handling from F14 is untouched.
 * ------------------------------------------------------------------ */

/**
 * Quoting and delimiter forms a provider can emit, each with the exact token
 * that must not survive. Every entry is a shape the pre-F15 pattern could not
 * reach, because its value began with a quote character.
 */
const QUOTED_SECRET_FORMS = [
  // Double-quoted value.
  ['api_key="LEAKED_DQ_1"', 'LEAKED_DQ_1'],
  ['{"api_key":"LEAKED_JSON_2"}', 'LEAKED_JSON_2'],
  ['token: "LEAKED_COLON_DQ_3"', 'LEAKED_COLON_DQ_3'],
  // Single-quoted value.
  ["password='LEAKED_SQ_4'", 'LEAKED_SQ_4'],
  ["{\"api_key\": 'LEAKED_JSON_SQ_5'}", 'LEAKED_JSON_SQ_5'],
  // Backtick value.
  ['api_key=`LEAKED_BT_6`', 'LEAKED_BT_6'],
  ['password=`LEAKED_BT_7`', 'LEAKED_BT_7'],
  // Quoted KEY, so the quote sits on the separator side.
  ['"api_key":"LEAKED_QKEY_8"', 'LEAKED_QKEY_8'],
  ["'token':'LEAKED_SQKEY_9'", 'LEAKED_SQKEY_9'],
  // A bearer pair inside quotes: the whole pair must be consumed, not just "Bearer".
  ['{"Authorization":"Bearer LEAKED_AUTHBQ_10"}', 'LEAKED_AUTHBQ_10'],
  ['{"token":"bearer LEAKED_LOWERBQ_11"}', 'LEAKED_LOWERBQ_11'],
  // Pretty-printed, multi-line JSON.
  ['{\n  "client_secret": "LEAKED_PRETTY_12",\n  "retries": 3\n}', 'LEAKED_PRETTY_12'],
  // A quoted secret sharing a line with unrelated quoted prose.
  ['{"note":"auth failed","api_key":"LEAKED_WITHPROSE_13"}', 'LEAKED_WITHPROSE_13'],
  // Nested object, and an array of objects.
  ['{"outer":{"api_key":"LEAKED_NEST_14"}}', 'LEAKED_NEST_14'],
  ['{"items":[{"password":"LEAKED_ARR_15"},{"api_key":"LEAKED_ARR_16"}]}', 'LEAKED_ARR_16'],
  // Whitespace around the separator, plus a quoted value.
  ['api-key  =  "LEAKED_SPACED_17"', 'LEAKED_SPACED_17'],
  ['"bearer": "LEAKED_BEARERKEY_18"', 'LEAKED_BEARERKEY_18'],
  // An escaped quote inside the quoted value.
  ['{"api_key":"LEAKED_ESC_19\\"X\\""}', 'LEAKED_ESC_19']
];

/**
 * One message holding every variant at once, so a single pass can be checked
 * for the whole family of secrets rather than form by form.
 */
function f15CombinedMessage() {
  const variants = [
    '{"api_key":"LEAKED_COMB_01","nested":{"password":"LEAKED_COMB_02"}}',
    'api-key = "LEAKED_COMB_03"',
    "client_secret='LEAKED_COMB_04'",
    'password=`LEAKED_COMB_05`',
    '"bearer": "LEAKED_COMB_06"',
    '{"Authorization":"Bearer LEAKED_COMB_07"}',
    'token=LEAKED_COMB_08',
    'Bearer LEAKED_COMB_09',
    '{\n  "client_secret": "LEAKED_COMB_10",\n  "retries": 3\n}',
    'X-Api-Key: LEAKED_COMB_11',
    'api_key=LEAKED_COMB_12',
    'bearer: LEAKED_COMB_13'
  ];
  return 'provider auth failed: ' + variants.join(' | ');
}

/** Every secret token the suite knows about, as one alternation. */
const ALL_KNOWN_SECRETS = [
  ...SANITIZER_PATTERNS.map(([, s]) => s),
  ...QUOTED_SECRET_FORMS.map(([, s]) => s)
];
const SECRET_LOOKALIKE = new RegExp(
  ALL_KNOWN_SECRETS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
);

test('F15: every quoted form is redacted in every consumer', () => {
  for (const c of CONSUMERS) {
    for (const [i, [message, secret]] of QUOTED_SECRET_FORMS.entries()) {
      const text = errorMessageFrom(c, message);
      assert.doesNotMatch(
        text,
        new RegExp(secret),
        `${c.label} leaked ${secret} from quoted form ${i}: ${text}`
      );
      assert.match(text, /\[REDACTED\]/, `${c.label} produced no marker for quoted form ${i}`);
      // The surrounding context is still there, so the row stays actionable.
      assert.ok(
        text.startsWith(c.prefix),
        `${c.label} lost the context for quoted form ${i}: ${text}`
      );
    }
  }
});

test('F15: the quote style is preserved, so a redacted JSON body still parses', () => {
  // [message, expected output, is the result real JSON]
  const cases = [
    ['{"api_key":"LEAKED_WF_1"}', '{"api_key":"[REDACTED]"}', true],
    ["{'api_key':'LEAKED_WF_2'}", "{'api_key':'[REDACTED]'}", false],
    ['{"api_key":"LEAKED_WF_3\\"X\\""}', '{"api_key":"[REDACTED]"}', true]
  ];
  for (const [message, expected, isJson] of cases) {
    const { store } = runErrorWorkflow(message);
    const text = store.rows('errors')[0].error_message;
    assert.equal(text, expected, `quote style was not preserved: ${text}`);
    if (isJson) {
      assert.doesNotThrow(
        () => JSON.parse(text),
        `redaction broke the JSON body: ${text}`
      );
    }
  }
});

/** Every secret token embedded in a message, so a check cannot go vacuous. */
function secretsIn(message) {
  return [...new Set(message.match(/LEAKED_[A-Z0-9_]+/g) || [])];
}

test('F15: no known secret pattern survives the combined all-variants fixture', () => {
  const message = f15CombinedMessage();
  // Derived from the fixture itself, so adding a variant cannot silently slip
  // past a hand-maintained list.
  const tokens = secretsIn(message);
  assert.ok(
    tokens.length >= 13,
    `the fixture must carry every variant, found only ${tokens.length}: ${tokens.join(', ')}`
  );

  for (const c of CONSUMERS) {
    const text = errorMessageFrom(c, message);

    for (const secret of tokens) {
      assert.doesNotMatch(
        text,
        new RegExp(secret),
        `${c.label} leaked ${secret} from the combined fixture`
      );
    }
    // The alternation over every secret the suite knows about: nothing
    // secret-shaped may remain anywhere in the output.
    const found = text.match(SECRET_LOOKALIKE);
    assert.equal(found, null, `${c.label} leaked a known pattern: ${text}`);

    // The redaction actually happened - a clean output because nothing was
    // matched would be a false pass.
    assert.match(text, /\[REDACTED\]/, `${c.label} redacted nothing at all`);
    // The row is still readable.
    assert.ok(
      text.startsWith(c.prefix + 'provider auth failed'),
      `${c.label} lost context: ${text.slice(0, 80)}`
    );
  }
});

test('F15: the object branch sanitises a quoted secret and stays valid JSON', () => {
  const { store } = runErrorWorkflow('lead capture failed: api_key="LEAKED_PAYLOAD_1" reading config');
  const row = store.rows('errors')[0];
  assert.ok(row);

  // payload is JSON.stringify(err) run through the object branch, so the
  // secret is nested inside an escaped-quoted JSON string.
  assert.doesNotMatch(row.payload, /LEAKED_PAYLOAD_1/, 'the payload must stay sanitised');
  assert.doesNotMatch(row.error_message, /LEAKED_PAYLOAD_1/, 'the message must stay sanitised');
  assert.doesNotThrow(() => JSON.parse(row.payload), `payload is no longer valid JSON: ${row.payload}`);
});

test('F15: the three consumers agree byte-for-byte on the same input', () => {
  const inputs = [f15CombinedMessage(), ...QUOTED_SECRET_FORMS.map(([m]) => m)];
  for (const message of inputs) {
    const rendered = CONSUMERS.map((c) => ({
      label: c.label,
      text: errorMessageFrom(c, message)
    }));
    // Drop the consumer-specific prefix WF01 adds, so only the sanitizer's
    // own output is compared. This asserts behaviour, not source text.
    const bodies = rendered.map((r) => r.text.slice(CONSUMERS.find((c) => c.label === r.label).prefix.length));
    assert.equal(
      new Set(bodies).size,
      1,
      `consumers disagreed on ${JSON.stringify(message.slice(0, 60))}: ${JSON.stringify(rendered)}`
    );
  }
});

test('F15: the shared block, sanitize() included, is byte-identical in all three', () => {
  const blocks = CONSUMERS.map((c) => {
    const code = c.loader().nodes.find((n) => n.name === c.node).parameters.jsCode;
    const start = code.indexOf('const SECRET_RE');
    const fn = code.indexOf('function sanitize');
    // through the closing brace of sanitize(), so whitespace drift is caught too
    return code.slice(start, code.indexOf('\n}', fn) + 2);
  });
  assert.equal(
    new Set(blocks).size,
    1,
    'the SECRET_RE + redactSecret + sanitize block must be byte-identical in all three consumers'
  );
});

test('F15: ordinary text, including quoted prose, is still NOT redacted', () => {
  const ordinary = [
    'the request body was {"retries": 3, "ok": true}',
    'node "Code in JavaScript" returned {"code": 401}',
    'smtp replied: {"message":"temporary failure"}',
    'The authorization service timed out after 5s',
    'Customer email failed: 535 authentication failed',
    'payment failed code=401 provider=resend'
  ];
  for (const c of CONSUMERS) {
    for (const message of ordinary) {
      const text = errorMessageFrom(c, message);
      assert.equal(text, c.prefix + message, `${c.label} altered ordinary text: ${text}`);
      assert.doesNotMatch(text, /\[REDACTED\]/, `${c.label} over-redacted: ${message}`);
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

/* ------------------------------------------------------------------ *
 * F16 - 05 - Follow-up Sweeper: a failed send was a silent infinite retry
 *
 * The sweeper's `Send Follow-up Email` node uses onError=continueErrorOutput
 * so one bad recipient never blocks the other candidates, and that is correct.
 * But its error branch terminated in a `noOp`, so a persistently failing
 * address was re-selected on EVERY hourly run, forever:
 *
 *   - followup_count is incremented only on the SUCCESS branch, and it counts
 *     real customer contacts, so a failing address never advanced it. That made
 *     the `followup_count < max_followups` eligibility gate structurally
 *     unreachable for a failing lead: the guard existed, but nothing could
 *     ever move the number it compares against.
 *   - the failure left no trace at all - no errors row, so the operator could
 *     not see it either.
 *
 * The fix records the failure (sanitised, via the shared F14/F15 block),
 * increments a dedicated `followup_fail_count`, and retires the lead with
 * status `failed` once a ceiling is reached. `failed` is deliberately distinct
 * from `no_response`: no_response means the customer was reached and chose not
 * to reply, whereas `failed` means we never managed to reach them.
 *
 * followup_count is NOT touched on the failure path. A transient SMTP outage
 * must not consume the customer's real follow-up allowance.
 * ------------------------------------------------------------------ */

/** A send that always fails, for the emailSend node's injected fault. */
const ALWAYS_FAILS = { emailFault: () => new Error('SMTP 550 mailbox unavailable') };

/** Drive the sweeper at a given clock, returning the engine (for its outbox). */
function runSweep(store, at, opts = {}) {
  return withClock(at, () => {
    const eng = new Engine(
      WF.sweeper(),
      engineOptions(store, { now: () => new Date(at).getTime(), ...opts })
    );
    eng.runAll(scheduleInput());
    return eng;
  });
}

/**
 * A store holding one fresh lead under test, plus the seeded historical lead.
 *
 * The historical lead is NOT suppressed: WF01's duplicate check depends on
 * reading at least one row, so an empty `leads` tab means intake silently
 * creates nothing. Every assertion below therefore filters by lead_id rather
 * than assuming the tab holds a single row.
 */
function leadUnderTest(sourceId, at = T0) {
  const store = newStore();
  const intake = runIntake(store, intakeBody({ source_id: sourceId }), at);
  const lead = store.rows('leads').find((r) => r.source_id === sourceId);
  assert.ok(lead, `intake must have created the lead under test (${sourceId})`);
  return { store, intake, leadId: lead.lead_id, lead, email: lead.email };
}

const leadNow = (store, leadId) => store.rows('leads').find((r) => r.lead_id === leadId);

const errorRowsFor = (store, leadId) => store.rows('errors').filter((r) => r.lead_id === leadId);

/** The outbox entries addressed to this lead, so the seeded lead is ignored. */
const sendsFor = (eng, email) => eng.outbox.filter((e) => e.to === email);

test('F16: a failed follow-up send increments the failure counter', () => {
  const { store, leadId, email } = leadUnderTest('f16-increments');

  // The lead is only due 24h after intake, per followup_delay_hours.
  const eng = runSweep(store, '2026-09-02T09:00:00.000Z', ALWAYS_FAILS);

  // The send really was attempted and really did fail.
  const sends = sendsFor(eng, email);
  assert.equal(sends.length, 1, 'the follow-up send must have been attempted');
  assert.equal(sends[0].sent, false, 'and it must have failed');

  const after = leadNow(store, leadId);
  assert.equal(after.followup_fail_count, '1', 'the failure must be counted');

  // ...and the counter is a real counter, not a constant: a second failure is 2.
  runSweep(store, '2026-09-02T10:00:00.000Z', ALWAYS_FAILS);
  assert.equal(leadNow(store, leadId).followup_fail_count, '2', 'the second failure must count again');
});

test('F16: a lead stops being selected once the failure ceiling is reached', () => {
  const { store, leadId, email } = leadUnderTest('f16-ceiling');

  // max_followups is 3, so the ceiling is max(24, 3*4) = 24.
  for (let i = 0; i < 24; i += 1) {
    runSweep(store, new Date(Date.parse(T0) + (24 + i) * 3600000).toISOString(), ALWAYS_FAILS);
  }

  const retired = leadNow(store, leadId);
  assert.equal(retired.followup_fail_count, '24', 'the ceiling is 24 for a max_followups of 3');
  assert.equal(retired.status, 'failed', 'the lead is retired at the ceiling');
  assert.equal(retired.next_followup_at, '', 'and it is unscheduled');

  // The decisive assertion: one more sweep must not touch it at all. Before
  // the fix this was unbounded - the lead was re-selected every hour forever.
  const after = runSweep(store, new Date(Date.parse(T0) + 500 * 3600000).toISOString(), ALWAYS_FAILS);
  assert.equal(
    sendsFor(after, email).length,
    0,
    'a retired lead must never be selected again'
  );
  assert.equal(
    leadNow(store, leadId).followup_fail_count,
    '24',
    'and its counter must not creep past the ceiling'
  );
});

test('F16: a persistently failing lead never reaches status no_response', () => {
  const { store, leadId } = leadUnderTest('f16-not-no-response');

  for (let i = 0; i < 24; i += 1) {
    runSweep(store, new Date(Date.parse(T0) + (24 + i) * 3600000).toISOString(), ALWAYS_FAILS);
  }

  const retired = leadNow(store, leadId);
  // The two states mean different things and must not be conflated.
  assert.equal(retired.status, 'failed', 'a delivery failure is `failed`');
  assert.notEqual(
    retired.status,
    'no_response',
    '`no_response` is reserved for a customer who was reached and did not reply'
  );
  // A retired lead is terminal: the sweeper must not resurrect it either.
  runSweep(store, new Date(Date.parse(T0) + 500 * 3600000).toISOString(), {});
  assert.equal(leadNow(store, leadId).status, 'failed', 'a retired lead stays retired');
});

test('F16: a failed follow-up send writes a fully populated errors row', () => {
  const { store, leadId, intake } = leadUnderTest('f16-errors-row');
  const eng = runSweep(store, '2026-09-02T09:00:00.000Z', ALWAYS_FAILS);

  const rows = errorRowsFor(store, leadId);
  assert.equal(rows.length, 1, 'exactly one errors row is written per failed send');
  const row = rows[0];

  // The same ten columns the other error consumers write.
  assert.deepEqual(
    Object.keys(row),
    ['error_id', 'created_at', 'workflow', 'node', 'business_id', 'lead_id', 'error_message', 'execution_id', 'payload', 'resolved'],
    'the errors row must use the shared ten-column contract'
  );

  assert.ok(row.error_id.startsWith('err_'), 'error_id is generated');
  assert.equal(row.created_at, '2026-09-02T09:00:00.000Z', 'created_at uses the run clock');
  assert.equal(row.workflow, '05 - Follow-up Sweeper', 'the failing workflow is attributed');
  assert.equal(row.node, 'Send Follow-up Email', 'the failing node is attributed');
  assert.equal(row.business_id, 'biz_lonestar_hvac', 'business_id is recorded');
  assert.equal(row.lead_id, leadId, 'lead_id is recorded');
  assert.equal(row.execution_id, eng.executionId, 'execution_id matches the execution');
  assert.equal(row.resolved, 'false', 'a new error starts unresolved');

  // The message must name the failure and say how far into the retry budget
  // it is, otherwise an operator cannot triage it.
  assert.match(row.error_message, /followup_email_failed/, 'the message is categorised');
  assert.match(row.error_message, /attempt 1\/24/, 'the attempt and ceiling are reported');
  assert.match(row.error_message, /SMTP 550 mailbox unavailable/, 'the provider reason survives');

  // The payload is machine-readable and carries the retry state.
  const payload = JSON.parse(row.payload);
  assert.equal(payload.lead_id, leadId);
  assert.equal(payload.followup_fail_count, 1);
  assert.equal(payload.followup_fail_ceiling, 24);
  assert.equal(payload.followup_count, 0, 'followup_count is still zero - no contact happened');

  void intake;
});

test('F16: no secret from a provider error reaches the errors row', () => {
  const SECRETY = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.SUPERSECRETPART.signature';
  const { store, leadId } = leadUnderTest('f16-secret');

  runSweep(store, '2026-09-02T09:00:00.000Z', {
    emailFault: () => new Error(`535 auth failed: ${SECRETY} (api_key=sk_live_9f3a2b7c1d)`)
  });

  const row = errorRowsFor(store, leadId)[0];
  assert.ok(row, 'the failure is still recorded');

  // error_message carries the provider's text, so it is the field that could
  // leak a credential. It must be redacted, and still readable.
  assert.doesNotMatch(
    row.error_message,
    /eyJhbGciOiJIUzI1NiJ9|SUPERSECRETPART|sk_live_9f3a2b7c1d/,
    'error_message must not carry a credential'
  );
  assert.match(row.error_message, /\[REDACTED\]/, 'error_message must show the redaction happened');
  assert.match(row.error_message, /535 auth failed/, 'the failure reason is still readable');

  // The payload is built from a fixed set of non-secret fields rather than
  // from the provider's text, so it has nothing to redact - but it must still
  // never echo the credential.
  assert.doesNotMatch(
    row.payload,
    /eyJhbGciOiJIUzI1NiJ9|SUPERSECRETPART|sk_live_9f3a2b7c1d/,
    'payload must not carry a credential'
  );
  const payload = JSON.parse(row.payload);
  assert.equal(payload.lead_id, leadId, 'the payload stays machine-readable after sanitising');
});

test('F16: the success path is unchanged - followup_count still counts only successful sends', () => {
  const { store, leadId, email } = leadUnderTest('f16-success-unchanged');

  // Three clean sweeps. Each must advance followup_count and leave the
  // failure counter completely alone.
  for (let i = 0; i < 3; i += 1) {
    const eng = runSweep(store, new Date(Date.parse(T0) + (24 + i * 24) * 3600000).toISOString(), {});
    const sends = sendsFor(eng, email);
    assert.equal(sends.length, 1, 'each sweep sends');
    assert.equal(sends[0].sent, true, 'and each send succeeds');
    const after = leadNow(store, leadId);
    assert.equal(after.followup_count, String(i + 1), `followup_count is ${i + 1} after ${i + 1} sends`);
    assert.equal(after.followup_fail_count, '', 'a success never touches the failure counter');
  }

  const final = leadNow(store, leadId);
  assert.equal(final.status, 'no_response', 'the existing terminal transition still happens');
  assert.equal(final.followup_count, '3', 'the allowance is spent exactly as before');
  assert.equal(errorRowsFor(store, leadId).length, 0, 'a clean run writes no errors rows');
});

test('F16: a transient failure followed by a success still advances normally', () => {
  const { store, leadId, email } = leadUnderTest('f16-transient');

  const failed = runSweep(store, '2026-09-02T09:00:00.000Z', ALWAYS_FAILS);
  assert.equal(sendsFor(failed, email)[0].sent, false);

  const afterFailure = leadNow(store, leadId);
  assert.equal(afterFailure.followup_fail_count, '1', 'the failure is counted');
  assert.equal(afterFailure.followup_count, '0', 'but no real contact happened, so it is not counted');
  assert.equal(afterFailure.status, 'new', 'and the lead is untouched otherwise');

  // The very next sweep succeeds, exactly as it would have before the fix.
  const recovered = runSweep(store, '2026-09-02T10:00:00.000Z', {});
  assert.equal(sendsFor(recovered, email)[0].sent, true, 'the retry gets through');
  const afterSuccess = leadNow(store, leadId);
  assert.equal(afterSuccess.followup_count, '1', 'the successful contact is counted');
  assert.equal(afterSuccess.followup_fail_count, '1', 'the failure history is not erased, only the ceiling is what matters');
  assert.notEqual(afterSuccess.status, 'failed', 'one blip never retires a lead');
});

  test('F16: the fix is confined to WF05\'s error path', () => {
  // Assert against the raw on-disk text, so a projected copy cannot satisfy it.
  const wf = JSON.parse(WF.sweeper().__raw);

  // The success path is byte-for-byte the code the fix did not need to touch.
  const advance = wf.nodes.find((n) => n.name === 'Advance Follow-up State').parameters.jsCode;
  assert.doesNotMatch(
    advance,
    /followup_fail_count/,
    'Advance Follow-up State must not learn about the failure counter'
  );
  assert.match(
    advance,
    /const count = \(Number\(j\.followup_count \?\? source\.followup_count \?\? 0\) \|\| 0\) \+ 1;/,
    'the success path still increments followup_count by exactly one'
  );
  assert.match(advance, /followup_count: count,/, 'and still writes it to the row');

  const update = wf.nodes.find((n) => n.name === 'Update Lead Follow-up State').parameters.fieldsUi;
  assert.deepEqual(
    update.values.map((v) => v.column),
    ['followup_count', 'last_contact_at', 'next_followup_at', 'status', 'updated_at'],
    'the existing success-path write is unchanged'
  );

  // The eligibility gate itself is unchanged apart from the new terminal status.
  const select = wf.nodes.find((n) => n.name === 'Select Follow-up Candidates').parameters.jsCode;
  assert.match(select, /if \(!\(count < max\)\) continue;/, 'followup_count < max_followups is still the gate');
  assert.match(
    select,
    /if \(\['booked', 'lost', 'closed', 'no_response', 'failed'\]\.indexOf\(status\) !== -1\) continue;/,
    'only `failed` is added to the terminal exclusion list'
  );

  // The failed-lead status is accepted and terminal in the status workflow.
  const status = JSON.parse(WF.status().__raw);
  const resolve = status.nodes
    .find((n) => n.name === 'Resolve Lead, Config & Validate Status')
    .parameters.jsCode;
  assert.match(
    resolve,
    /const ALLOWED = \[[^\]]*'failed'\]/,
    'WF04 must accept `failed` as a new_status'
  );
  assert.match(
    resolve,
    /_terminal: \['booked', 'lost', 'closed', 'no_response', 'failed'\]/,
    '`failed` must be terminal in WF04, so a status change cannot resurrect a retired lead'
  );
});

test('F16: the fix is confined to the new nodes', () => {
  const wf = JSON.parse(WF.sweeper().__raw);

  // The dead-end is gone and the new chain exists.
  assert.equal(
    wf.nodes.some((n) => n.name === 'End Failed Sends'),
    false,
    'the noOp the error branch used to terminate in must be removed'
  );
  for (const name of ['Build Failed Follow-up Record', 'Append Follow-up Error', 'Update Lead Follow-up Retry']) {
    assert.ok(
      wf.nodes.some((n) => n.name === name),
      `${name} must exist`
    );
  }

  // Both writes hang off the Code node, not off each other. A Sheets append
  // returns the appended ROW, so chaining the leads update after the errors
  // append would resolve every retry field to '' and wipe the lead's status.
  // F17 adds a third sibling on the same Code output - the shared status_updates
  // builder - which reads the pre-update item for the same F5 reason.
  const fanout = wf.connections['Build Failed Follow-up Record'].main[0];
  assert.deepEqual(
    fanout.map((t) => t.node).sort(),
    ['Append Follow-up Error', 'Build Follow-up Status Record', 'Update Lead Follow-up Retry'],
    'every write must read the Code node output'
  );
  assert.equal(
    wf.connections['Append Follow-up Error'],
    undefined,
    'the errors append must not feed the leads update'
  );
  assert.equal(
    wf.connections['Update Lead Follow-up Retry'],
    undefined,
    'the leads update must not feed the status builder'
  );

  // The two writes are declared, and the retry write is a partial update that
  // never touches followup_count - that column means "real contacts".
  const retry = wf.nodes.find((n) => n.name === 'Update Lead Follow-up Retry').parameters;
  assert.equal(retry.operation, 'update', 'the retry state is an update, not an append');
  assert.equal(retry.columnToMatchOn, 'lead_id', 'matched by lead_id');
  assert.deepEqual(
    retry.fieldsUi.values.map((v) => v.column),
    ['followup_fail_count', 'status', 'next_followup_at', 'updated_at'],
    'only the failure columns are written'
  );
  assert.equal(
    retry.fieldsUi.values.some((v) => v.column === 'followup_count'),
    false,
    'a failed send must never consume the customer follow-up allowance'
  );

  // The errors append uses the same ten columns as every other consumer.
  const append = wf.nodes.find((n) => n.name === 'Append Follow-up Error').parameters;
  assert.deepEqual(
    append.fieldsUi.fieldValues.map((v) => v.fieldId),
    ['error_id', 'created_at', 'workflow', 'node', 'business_id', 'lead_id', 'error_message', 'execution_id', 'payload', 'resolved'],
    'the shared ten-column errors contract is reused'
  );

  // The sanitize block is the shared F14/F15 one, not a fourth variant.
  const code = wf.nodes.find((n) => n.name === 'Build Failed Follow-up Record').parameters.jsCode;
  const start = code.indexOf('const SECRET_RE');
  const fn = code.indexOf('function sanitize');
  const block = code.slice(start, code.indexOf('\n}', fn) + 2);
  const intake = JSON.parse(WF.intake().__raw);
  const ref = intake.nodes.find((n) => n.name === 'Build Customer Email Error Record').parameters.jsCode;
  const refStart = ref.indexOf('const SECRET_RE');
  const refFn = ref.indexOf('function sanitize');
  assert.equal(
    block,
    ref.slice(refStart, ref.indexOf('\n}', refFn) + 2),
    'the sanitize block must be reused byte-for-byte, not re-implemented'
  );

  // The default-on-read and the ceiling are spelled exactly as reviewed.
  assert.match(
    code,
    /const nextFailCount = Number\(lead\.followup_fail_count \|\| 0\) \+ 1;/,
    'an absent followup_fail_count must default to 0 on read'
  );
  assert.match(
    code,
    /Math\.max\(24, Number\(config\.max_followups \|\| 3\) \* 4\)/,
    'the ceiling has a hard floor of 24 and scales with max_followups'
  );
  assert.match(
    code,
    /status: reachedCeiling \? 'failed' : lead\.status/,
    'only the ceiling changes the status'
  );
  assert.match(
    code,
    /next_followup_at: reachedCeiling \? '' : lead\.next_followup_at/,
    'only the ceiling unschedules the lead'
  );
});

/* ------------------------------------------------------------------ *
 * F17 - 05 - Follow-up Sweeper: both terminal transitions were unaudited
 *
 * The sweeper moves a lead out of the funnel in exactly two ways:
 *
 *   - 'no_response' when followup_count reaches max_followups. The customer
 *     was reached three times and chose not to reply.
 *   - 'failed' when followup_fail_count reaches the delivery ceiling (F16).
 *     We never managed to reach them at all.
 *
 * Both transitions were persisted to the leads tab and both were silent in
 * status_updates. An operator auditing a lead that had vanished from the
 * pipeline found no history explaining why: no_response and failed were
 * indistinguishable from a lead someone had simply deleted. WF04 already
 * writes status_updates rows for the transitions a human drives, so the
 * automated ones were the conspicuous gap.
 *
 * The fix is one shared builder + one append, fed as a sibling branch off
 * each of the two Code nodes so it reads the PRE-update item. That is the F5
 * invariant: a Google Sheets write returns the stored row, which carries only
 * 'status', so old_status would be lost and there would be nothing to compare
 * it against. The builder therefore emits a row only when the status actually
 * CHANGED, which keeps an ordinary successful follow-up and a below-ceiling
 * delivery failure - both of which leave status untouched - from appending a
 * no-op row on every hourly sweep.
 * ------------------------------------------------------------------ */

/** The status_updates rows belonging to this lead, oldest first. */
const statusRowsFor = (store, leadId) =>
  store.rows('status_updates').filter((r) => r.lead_id === leadId);

/** The i-th hourly sweep after intake, as an ISO clock string. */
const sweepHour = (i) => new Date(Date.parse(T0) + i * 3600000).toISOString();

test('F17: reaching the follow-up cap writes a status_updates row', () => {
  const { store, leadId, email } = leadUnderTest('f17-no-response');

  // Two clean sweeps: the lead is contacted twice and simply stays 'new'.
  for (let i = 0; i < 2; i += 1) {
    const eng = runSweep(store, sweepHour(24 + i * 24), {});
    assert.equal(sendsFor(eng, email)[0].sent, true, `sweep ${i + 1} must succeed`);
    assert.equal(
      leadNow(store, leadId).status,
      'new',
      `sweep ${i + 1} must not retire the lead`
    );
    assert.equal(
      statusRowsFor(store, leadId).length,
      0,
      'a non-terminal follow-up is not a transition and writes no row'
    );
  }

  // The third send spends the allowance and retires the lead.
  const before = leadNow(store, leadId).status;
  const eng = runSweep(store, sweepHour(72), {});
  assert.equal(sendsFor(eng, email)[0].sent, true, 'the third send succeeds');
  assert.equal(leadNow(store, leadId).status, 'no_response', 'the lead is retired');

  const rows = statusRowsFor(store, leadId);
  assert.equal(rows.length, 1, 'the transition is recorded exactly once');
  const row = rows[0];

  assert.equal(row.business_id, 'biz_lonestar_hvac', 'the tenant is recorded');
  assert.equal(row.old_status, before, 'old_status is the status held BEFORE the transition');
  assert.equal(row.new_status, 'no_response', 'new_status is where the lead ended up');
  assert.equal(row.updated_by, 'followup_sweeper', 'the row is attributed to the sweeper, not a human');
  assert.match(row.notes, /follow-up cap reached/, 'the note explains WHY the lead was retired');
  assert.ok(row.update_id.startsWith('upd_'), 'update_id is generated');
  assert.equal(row.created_at, sweepHour(72), 'created_at uses the run clock');
});

test('F17: reaching the delivery ceiling writes a status_updates row', () => {
  const { store, leadId } = leadUnderTest('f17-failed');

  // max_followups is 3, so the ceiling is max(24, 3*4) = 24. Only the 24th
  // failure retires the lead, so only that sweep may write a row.
  for (let i = 0; i < 23; i += 1) {
    runSweep(store, sweepHour(24 + i), ALWAYS_FAILS);
  }
  assert.equal(leadNow(store, leadId).status, 'new', '23 failures have not retired the lead');
  assert.equal(
    statusRowsFor(store, leadId).length,
    0,
    'a below-ceiling failure is not a transition and writes no row'
  );

  const before = leadNow(store, leadId).status;
  runSweep(store, sweepHour(24 + 23), ALWAYS_FAILS);
  assert.equal(leadNow(store, leadId).status, 'failed', 'the ceiling retires the lead');

  const rows = statusRowsFor(store, leadId);
  assert.equal(rows.length, 1, 'the transition is recorded exactly once');
  const row = rows[0];
  assert.equal(row.old_status, before, 'old_status is the status held BEFORE the transition');
  assert.equal(row.new_status, 'failed', 'new_status is where the lead ended up');
  assert.equal(row.updated_by, 'followup_sweeper', 'the row is attributed to the sweeper');
  assert.match(row.notes, /retired after 24 delivery failures/, 'the note gives the failure count');
  assert.match(row.notes, /ceiling 24/, 'and the ceiling it hit');
  // F18 is still open: the counter is cumulative, so the note must not imply
  // that 24 CONSECUTIVE failures were required.
  assert.doesNotMatch(row.notes, /consecutive/i, 'the note must not claim the failures were consecutive');
});

test('F17: no status_updates row is written before the transition', () => {
  // Both branches active in ONE sweep: one send lands, one bounces. Neither is
  // terminal, so the shared builder must emit nothing from EITHER branch. This
  // is the strongest form of the gate - it is keyed on the transition, not on
  // which branch produced the item.
  const store = newStore();
  runIntake(store, intakeBody({ source_id: 'f17-gate-ok', email: 'ok.lead@example.com', phone: '5125550888' }), T0);
  runIntake(
    store,
    intakeBody({ source_id: 'f17-gate-bad', email: 'bounce@bounce.test', phone: '5125550999' }),
    T0
  );
  const ok = store.rows('leads').find((r) => r.source_id === 'f17-gate-ok');
  const bad = store.rows('leads').find((r) => r.source_id === 'f17-gate-bad');
  assert.ok(ok && bad, 'both leads must exist, on distinct dedup keys');

  const eng = runSweep(store, sweepHour(24), {
    emailFault: (spec) => (spec.to === 'bounce@bounce.test' ? new Error('SMTP 550 mailbox unavailable') : null)
  });

  assert.equal(sendsFor(eng, 'ok.lead@example.com')[0].sent, true, 'the good address is reached');
  assert.equal(sendsFor(eng, 'bounce@bounce.test')[0].sent, false, 'the bad address bounces');

  const okAfter = leadNow(store, ok.lead_id);
  const badAfter = leadNow(store, bad.lead_id);
  assert.equal(okAfter.followup_count, '1', 'the clean lead was contacted');
  assert.equal(okAfter.status, 'new', 'and is still open');
  assert.equal(badAfter.followup_fail_count, '1', 'the bad lead recorded a failure');
  assert.equal(badAfter.status, 'new', 'and is still open');
  assert.equal(
    store.rows('status_updates').length,
    0,
    'neither branch may write a row for a non-terminal sweep'
  );

  // The gate must be SELECTIVE, not merely silent. Drive the clean lead the
  // remaining two sends and assert its row appears - so this test cannot be
  // satisfied by a builder that never writes anything, and cannot pass against
  // a pre-fix workflow where no row is ever produced.
  for (let i = 1; i <= 2; i += 1) {
    runSweep(store, sweepHour(24 + i * 24), {
      emailFault: (spec) => (spec.to === 'bounce@bounce.test' ? new Error('SMTP 550 mailbox unavailable') : null)
    });
  }
  assert.equal(leadNow(store, ok.lead_id).status, 'no_response', 'the clean lead is retired');
  assert.equal(
    statusRowsFor(store, ok.lead_id).length,
    1,
    'the row appears exactly when the transition happens'
  );
  assert.equal(
    statusRowsFor(store, bad.lead_id).length,
    0,
    'the still-open failing lead has no row, so the gate tracks the transition'
  );
});

test('F17: the recorded old_status is the pre-transition value', () => {
  // Claim 2 of the review, settled by construction: the fixture's status
  // immediately before the terminal sweep is asserted against the recorded
  // old_status. This is NOT a pre-fix failure claim - pre-fix there is no row
  // at all to read.
  const { store, leadId } = leadUnderTest('f17-old-status');
  for (let i = 0; i < 2; i += 1) runSweep(store, sweepHour(24 + i * 24), {});

  const statusBefore = leadNow(store, leadId).status;
  assert.equal(statusBefore, 'new', 'the fixture is a fresh lead, still in `new`');

  runSweep(store, sweepHour(72), {});
  const row = statusRowsFor(store, leadId)[0];
  assert.ok(row, 'the transition is recorded');
  assert.equal(row.old_status, 'new', 'old_status is exactly the pre-transition status');
  assert.equal(row.old_status, statusBefore, 'and it is the value observed before the sweep');
  assert.notEqual(row.old_status, row.new_status, 'a transition is by definition a change');
  assert.equal(row.new_status, leadNow(store, leadId).status, 'new_status matches the persisted lead');
});

test('F17: a retired lead is never transitioned twice', () => {
  // A terminal lead stops being selected, so the risk is the inverse one: a
  // duplicate append if the gate ever let a no-op through.
  const { store, leadId } = leadUnderTest('f17-no-duplicate');
  for (let i = 0; i < 3; i += 1) runSweep(store, sweepHour(24 + i * 24), {});
  assert.equal(statusRowsFor(store, leadId).length, 1, 'one row for the transition');

  for (const hour of [200, 400, 900]) {
    runSweep(store, sweepHour(hour), {});
    assert.equal(
      statusRowsFor(store, leadId).length,
      1,
      `a later sweep (t+${hour}h) must not append a second row`
    );
  }
  assert.equal(leadNow(store, leadId).status, 'no_response', 'and the lead stays retired');
});

test('F17: one shared builder serves both terminal transitions', () => {
  const wf5 = JSON.parse(WF.sweeper().__raw);

  const builders = wf5.nodes.filter((n) => n.name === 'Build Follow-up Status Record');
  assert.equal(builders.length, 1, 'the two transitions share ONE builder, not one each');
  const appends = wf5.nodes.filter((n) => n.name === 'Append Follow-up Status Update');
  assert.equal(appends.length, 1, 'and one append');

  // Both terminal branches must reach it, and the append must hang off nothing
  // else - otherwise a second transition path could be added that never lands
  // in status_updates.
  const sources = Object.entries(wf5.connections)
    .filter(([, v]) => v.main.some((branch) => branch.some((t) => t.node === 'Build Follow-up Status Record')))
    .map(([k]) => k)
    .sort();
  assert.deepEqual(
    sources,
    ['Advance Follow-up State', 'Build Failed Follow-up Record'],
    'both terminal Code nodes feed the shared builder'
  );

  assert.deepEqual(
    wf5.connections['Build Follow-up Status Record'].main[0].map((t) => t.node),
    ['Append Follow-up Status Update'],
    'the builder feeds only the append'
  );

  // The F5 invariant, in wiring form: neither Google Sheets write may sit
  // between a Code node and the builder.
  for (const leaf of ['Update Lead Follow-up State', 'Update Lead Follow-up Retry', 'Append Follow-up Error']) {
    assert.equal(wf5.connections[leaf], undefined, `${leaf} must stay a leaf`);
  }

  // The builder reads $input, never a Sheets result.
  const builder = builders[0].parameters.jsCode;
  assert.doesNotMatch(
    builder,
    /\$\('Update Lead Follow-up State'\)|\$\('Update Lead Follow-up Retry'\)|\$\('Append Follow-up Error'\)/,
    'the builder must read the pre-update Code output, not a Sheets write result'
  );
  assert.match(builder, /\$input\.all\(\)/, 'it reads the incoming items directly');
});

test('F17: the status_updates append reuses the shared eight-column contract', () => {
  const wf5 = JSON.parse(WF.sweeper().__raw);
  const append = wf5.nodes.find((n) => n.name === 'Append Follow-up Status Update').parameters;
  const ref = JSON.parse(WF.status().__raw).nodes.find((n) => n.name === 'Append Status Update').parameters;

  assert.equal(append.operation, 'append', 'status_updates is appended to, never overwritten');
  assert.equal(append.sheetName.value, 'status_updates', 'the tab is status_updates');
  assert.equal(
    append.documentId.value,
    ref.documentId.value,
    'the same spreadsheet as every other consumer'
  );
  assert.deepEqual(
    append.fieldsUi.fieldValues.map((v) => v.fieldId),
    ['update_id', 'created_at', 'lead_id', 'business_id', 'old_status', 'new_status', 'updated_by', 'notes'],
    'exactly the status_updates headers, in order'
  );
  assert.deepEqual(
    append.fieldsUi.fieldValues,
    ref.fieldsUi.fieldValues,
    'the mapping is copied from WF04 rather than re-derived'
  );

  // The row the builder produces must have those same eight keys - a missing
  // key would append a blank cell, which is how F10 shipped.
  const builder = wf5.nodes.find((n) => n.name === 'Build Follow-up Status Record').parameters.jsCode;
  for (const key of ['update_id', 'created_at', 'lead_id', 'business_id', 'old_status', 'new_status', 'updated_by', 'notes']) {
    assert.match(builder, new RegExp('^\\s+' + key + ':', 'm'), `the builder must emit ${key}`);
  }
});

test('F17: the sanitize block is byte-identical to the fd75d62 original', () => {
  const wf5 = JSON.parse(WF.sweeper().__raw);
  const builder = wf5.nodes.find((n) => n.name === 'Build Follow-up Status Record').parameters.jsCode;

  const start = builder.indexOf('const SECRET_RE');
  const fn = builder.indexOf('function sanitize');
  assert.ok(start >= 0 && fn > start, 'the builder must carry the shared sanitize block');
  const block = builder.slice(start, builder.indexOf('\n}', fn) + 2);

  assert.equal(
    createHash('sha256').update(block).digest('hex'),
    'd7ffc93db65e5c0c6e7ccb4ecd4bb89e9768522d90b4a8e9c26af611c36435aa',
    'the block must hash to the fd75d62 original, so a fourth variant can never creep in'
  );

  // Byte-for-byte against the two existing copies, not just the hash.
  for (const [wfName, nodeName] of [
    ['intake', 'Build Customer Email Error Record'],
    ['sweeper', 'Build Failed Follow-up Record']
  ]) {
    const other = JSON.parse(WF[wfName]().__raw).nodes.find((n) => n.name === nodeName).parameters.jsCode;
    const os = other.indexOf('const SECRET_RE');
    const of_ = other.indexOf('function sanitize');
    assert.equal(
      block,
      other.slice(os, other.indexOf('\n}', of_) + 2),
      `the block must be identical to the copy in ${nodeName}`
    );
  }

  // And the free-text fields must actually route through it.
  assert.match(builder, /updated_by: sanitize\(/, 'updated_by is sanitised');
  assert.match(builder, /notes: sanitize\(/, 'notes is sanitised');
});

test('F17: the F16 byte-identity invariant holds under the new named deltas', () => {
  const wf5 = JSON.parse(WF.sweeper().__raw);
  const advance = wf5.nodes.find((n) => n.name === 'Advance Follow-up State').parameters.jsCode;
  const failed = wf5.nodes.find((n) => n.name === 'Build Failed Follow-up Record').parameters.jsCode;

  // The exact pre-F16 text of 'Advance Follow-up State', pinned as data. F16
  // proved the fix did not touch the success path; this pins that proof to
  // bytes rather than to a handful of regexes, so F17's additions have to be
  // declared one by one.
  const ADVANCE_BASELINE = "const candidates = $('Select Follow-up Candidates').all();\n\nreturn $input.all().map((it, index) => {\n  const j = it.json;\n\n  // Prefer lead_id already present on the current item.\n  // If the Email node stripped it, recover it from the\n  // corresponding eligible-follow-up item.\n  const source = candidates[index]?.json || {};\n  const leadId = String(j.lead_id || source.lead_id || '').trim();\n\n  if (!leadId) {\n    throw new Error(\n      `Missing lead_id in Advance Follow-up State. Item ${index + 1} has no lead_id.`\n    );\n  }\n\n  const count = (Number(j.followup_count ?? source.followup_count ?? 0) || 0) + 1;\n  const max = Number(j.max_followups ?? source.max_followups ?? 3) || 3;\n  const delay = Number(j.followup_delay_hours ?? source.followup_delay_hours ?? 24) || 24;\n\n  const nowIso = new Date().toISOString();\n  const reachedMax = count >= max;\n\n  return {\n    json: {\n      ...source,\n      ...j,\n\n      lead_id: leadId,\n      followup_count: count,\n      last_contact_at: nowIso,\n      next_followup_at: reachedMax\n        ? ''\n        : new Date(Date.now() + delay * 3600 * 1000).toISOString(),\n      status: reachedMax\n        ? 'no_response'\n        : String(j.status ?? source.status ?? 'new'),\n      updated_at: nowIso\n    }\n  };\n});";
  const FAILED_BASELINE = "// F16 - WF05 failed follow-up sends used to dead-end at a noOp, so a\n// persistently failing address was re-selected every hour forever and\n// followup_count (which only ever counts SUCCESSFUL sends) never moved, making\n// max_followups structurally unreachable. This node records the failure, counts\n// total delivery failures in its own field, and retires the lead once the ceiling is\n// reached. followup_count is deliberately NOT touched here: it stays a record of\n// real contacts, so a transient SMTP failure cannot burn the customer's allowance.\nconst candidates = $('Select Follow-up Candidates').all();\nconst configs = $('Get Active Businesses').all();\nconst SECRET_RE = /(bearer)(\\s+)([^,}\"'`\\s]+)|(secret|token|password|api[_ -]?key|authorization|bearer)((?:\\\\?[\"'])?\\s*[:=]\\s*)(\"(?:[^\"\\\\]|\\\\.)*\"|\\\\\"(?:[^\"\\\\]|\\\\.)*?\\\\\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`|bearer\\s+[^,}\"'`\\s]+|[^,}\"'`\\s]+)/gi;\n// Redacts a secret whatever delimiter or quoting surrounds it, so the shape a\n// provider happens to emit cannot decide whether the value is reached. The value\n// may be a double-quoted, single-quoted or backtick literal, a JSON-escaped\n// double-quoted literal (which is what JSON.stringify hands the object branch),\n// a `Bearer <credential>` pair, or a bare token. `redactSecret` re-emits the\n// leading delimiter it found, quote and backslash included, so a redacted JSON\n// payload stays well-formed and parseable instead of being cut in half. The\n// leading branch still catches a bare \"Bearer <credential>\" with no keyword\n// separator, and the value group may itself be \"Bearer <credential>\", so a\n// header-style \"Authorization: Bearer <jwt>\" is consumed whole rather than\n// leaving the JWT behind.\nconst redactSecret = (m, bearer, ws, token, keyword, sep, value) => {\n  if (bearer) return bearer + ws + '[REDACTED]';\n  const open = /^(\\\\?[\"'`])/.exec(value);\n  const q = open ? open[1] : '';\n  return keyword + sep + q + '[REDACTED]' + q;\n};\nfunction sanitize(v){\n  if (v === null || v === undefined) return '';\n  if (typeof v === 'object') return JSON.stringify(v).replace(SECRET_RE, redactSecret);\n  return String(v).replace(SECRET_RE, redactSecret);\n}\n\nreturn $input.all().map((it, index) => {\n  const j = it.json;\n\n  // The error item carries the candidate, but recover it the same defensive way\n  // 'Advance Follow-up State' does so a stripped field cannot throw here.\n  const source = candidates[index]?.json || {};\n\n  const bid = String(j.business_id ?? source.business_id ?? '').trim();\n  const lead = {\n    lead_id: String(j.lead_id ?? source.lead_id ?? '').trim(),\n    business_id: bid,\n    status: String(j.status ?? source.status ?? ''),\n    next_followup_at: String(j.next_followup_at ?? source.next_followup_at ?? ''),\n    followup_fail_count: j.followup_fail_count ?? source.followup_fail_count ?? ''\n  };\n  if (!lead.lead_id) {\n    throw new Error(\n      `Missing lead_id in Build Failed Follow-up Record. Item ${index + 1} has no lead_id.`\n    );\n  }\n\n  const cfg = configs.find((c) => String(c.json.business_id || '').trim() === bid);\n  const config = cfg ? cfg.json : {};\n  const max = Number(j.max_followups ?? source.max_followups ?? config.max_followups ?? 3) || 3;\n\n  // Ceiling is a hard default, deliberately far above max_followups: a\n  // temporary provider outage must not consume the customer's real follow-ups.\n  const ceiling = Math.max(24, Number(config.max_followups || 3) * 4);\n\n  // The field is absent on every pre-existing row, so it defaults on read.\n  // WF01/WF03 are NOT changed: absent means 0.\n  const nextFailCount = Number(lead.followup_fail_count || 0) + 1;\n  const reachedCeiling = nextFailCount >= ceiling;\n  const nowIso = new Date().toISOString();\n\n  const rawErr = j.error !== undefined ? j.error : j._emailError;\n  const msg =\n    typeof rawErr === 'object' && rawErr !== null\n      ? String(rawErr.message || JSON.stringify(rawErr))\n      : String(rawErr || 'unknown follow-up email error');\n\n  return {\n    json: {\n      lead_id: lead.lead_id,\n      business_id: bid,\n      followup_fail_count: nextFailCount,\n      followup_fail_ceiling: ceiling,\n      failed_attempts_remaining: Math.max(0, ceiling - nextFailCount),\n      // Unchanged until the ceiling is reached, so the partial update is a\n      // no-op for these two columns on an ordinary failure.\n      status: reachedCeiling ? 'failed' : lead.status,\n      next_followup_at: reachedCeiling ? '' : lead.next_followup_at,\n      updated_at: nowIso,\n      error_id: 'err_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),\n      created_at: nowIso,\n      workflow: '05 - Follow-up Sweeper',\n      node: 'Send Follow-up Email',\n      error_message: sanitize(\n        'followup_email_failed (attempt ' + nextFailCount + '/' + ceiling + ', followup_count ' +\n        String(j.followup_count ?? source.followup_count ?? 0) + '/' + max + '): ' + msg\n      ).slice(0, 2000),\n      execution_id: $execution.id,\n      payload: sanitize({\n        lead_id: lead.lead_id,\n        business_id: bid,\n        followup_count: Number(j.followup_count ?? source.followup_count ?? 0) || 0,\n        max_followups: max,\n        followup_fail_count: nextFailCount,\n        followup_fail_ceiling: ceiling\n      }).slice(0, 4000),\n      resolved: false\n    }\n  };\n});\n";

  assert.equal(
    createHash('sha256').update(ADVANCE_BASELINE).digest('hex'),
    '6651e9a63d9497d4b2d55f3f77fd34e9a5e8dc5116a78679aaeb4acc74eda5bb',
    'the pinned baseline is the reviewed pre-F16 source'
  );

  // The declared deltas. Each must apply exactly once, and applying all of them
  // must reproduce the on-disk source exactly.
  const advanceDeltas = [["capture the pre-transition status into oldStatus","  const nowIso = new Date().toISOString();\n  const reachedMax = count >= max;","  // F17: capture the status the lead is in RIGHT NOW, before the terminal\n  // assignment below overwrites it. 'status' is the only field a Sheets update\n  // persists, so once this node overwrote it the pre-transition value was gone -\n  // and a status_updates row written downstream could only ever record the new\n  // value. Same invariant as WF04's 'Prepare Updated Lead'.\n  const oldStatus = String(j.status ?? source.status ?? '').trim();\n\n  const nowIso = new Date().toISOString();\n  const reachedMax = count >= max;"],["emit old_status on the row it builds","      next_followup_at: reachedMax\n        ? ''\n        : new Date(Date.now() + delay * 3600 * 1000).toISOString(),\n      status: reachedMax","      next_followup_at: reachedMax\n        ? ''\n        : new Date(Date.now() + delay * 3600 * 1000).toISOString(),\n      old_status: oldStatus,\n      status: reachedMax"]];
  let rebuilt = ADVANCE_BASELINE;
  for (const [label, from, to] of advanceDeltas) {
    const hits = rebuilt.split(from).length - 1;
    assert.equal(hits, 1, `the delta "${label}" must anchor on exactly one site, found ${hits}`);
    rebuilt = rebuilt.replace(from, to);
  }
  assert.equal(
    rebuilt,
    advance,
    'the ONLY change to the F16 success path is the declared F17 old_status delta'
  );
  assert.equal(
    advanceDeltas.length,
    2,
    'a new undeclared change to the success path must be added here explicitly'
  );

  // F16's own confinement claim still has to hold.
  assert.doesNotMatch(advance, /followup_fail_count/, 'the success path must not learn about failures');
  assert.match(
    advance,
    /const count = \(Number\(j\.followup_count \?\? source\.followup_count \?\? 0\) \|\| 0\) \+ 1;/,
    'and must still increment followup_count by exactly one'
  );

  // F17 also touches the failure branch, so pin that one the same way.
  const failedDeltas = [["emit old_status on the retirement row","      status: reachedCeiling ? 'failed' : lead.status,","      old_status: lead.status,\n      status: reachedCeiling ? 'failed' : lead.status,"]];
  let rebuiltFailed = FAILED_BASELINE;
  for (const [label, from, to] of failedDeltas) {
    const hits = rebuiltFailed.split(from).length - 1;
    assert.equal(hits, 1, `the delta "${label}" must anchor on exactly one site, found ${hits}`);
    rebuiltFailed = rebuiltFailed.replace(from, to);
  }
  assert.equal(
    rebuiltFailed,
    failed,
    'the ONLY change to the F16 failure path is the declared F17 old_status delta'
  );
  assert.equal(failedDeltas.length, 1, 'a new undeclared change must be added here explicitly');
});

/* ------------------------------------------------------------------ *
 * Sanitizer byte-identity across ALL FIVE consumers.
 *
 * F14's test covers WF01 x2 + WF06. F17's test covers WF05 x2 and pins
 * one hash. Neither spans all five, so a sixth consumer carrying a
 * divergent block would pass both. Tracked follow-up recorded in
 * measurement/FINDINGS.md under the F15 resolution, "Known coverage gap".
 * ------------------------------------------------------------------ */

/** The block as it stands at fd75d62. Do NOT change this without authorisation. */
const SANITIZE_BLOCK_SHA256 = 'd7ffc93db65e5c0c6e7ccb4ecd4bb89e9768522d90b4a8e9c26af611c36435aa';
const SANITIZE_BLOCK_CHARS = 1509;
const SANITIZE_BLOCK_LINES = 23;

const SANITIZE_CONSUMERS = [
  { label: 'WF01 Build Customer Email Error Record', loader: WF.intake, node: 'Build Customer Email Error Record' },
  { label: 'WF01 Build Owner Email Error Record', loader: WF.intake, node: 'Build Owner Email Error Record' },
  { label: 'WF05 Build Failed Follow-up Record', loader: WF.sweeper, node: 'Build Failed Follow-up Record' },
  { label: 'WF05 Build Follow-up Status Record', loader: WF.sweeper, node: 'Build Follow-up Status Record' },
  { label: 'WF06 Build & Sanitize Error Record', loader: WF.errorHandler, node: 'Build & Sanitize Error Record' }
];

/**
 * Extract the sanitize() block from a Code node.
 *
 * Boundaries: the block starts at the hoisted `const SECRET_RE` and ends at
 * the column-0 `}` that closes `function sanitize`. The end is found with
 * `indexOf('\n}', fn)` rather than brace counting because this Code node body
 * is indented — every nested brace sits at column >= 2 — so the first `\n}`
 * after `function sanitize` is that function's own terminator, not a nested
 * one. Hashing the whole jsCode is deliberately NOT done: the surrounding
 * code differs per node and only this region is supposed to be shared.
 */
function sanitizeBlockOf(consumer) {
  const wf = consumer.loader();
  const node = wf.nodes.find((n) => n.name === consumer.node);
  assert.ok(node, `${consumer.label}: node not found in ${wf.__file}`);

  const code = node.parameters.jsCode;
  const start = code.indexOf('const SECRET_RE');
  const fn = code.indexOf('function sanitize');
  assert.ok(start >= 0, `${consumer.label}: no SECRET_RE in ${wf.__file}`);
  assert.ok(fn > start, `${consumer.label}: no sanitize() after SECRET_RE in ${wf.__file}`);

  const close = code.indexOf('\n}', fn);
  assert.ok(close > fn, `${consumer.label}: sanitize() is not closed in ${wf.__file}`);

  const block = code.slice(start, close + 2);
  return {
    label: consumer.label,
    file: wf.__file,
    block,
    chars: block.length,
    lines: block.split('\n').length,
    hash: createHash('sha256').update(block).digest('hex')
  };
}

test('SANITIZER: all five consumers carry one byte-identical sanitize() block', () => {
  const found = SANITIZE_CONSUMERS.map(sanitizeBlockOf);

  // Per-consumer shape guards, so a shifted boundary is reported as such
  // rather than as a mysterious hash mismatch.
  for (const f of found) {
    assert.equal(
      f.chars,
      SANITIZE_BLOCK_CHARS,
      `${f.label} (${f.file}): sanitize block is ${f.chars} chars, expected ${SANITIZE_BLOCK_CHARS} — ` +
        'the extraction boundaries or the block itself changed'
    );
    assert.equal(
      f.lines,
      SANITIZE_BLOCK_LINES,
      `${f.label} (${f.file}): sanitize block is ${f.lines} lines, expected ${SANITIZE_BLOCK_LINES}`
    );
  }

  // One distinct block across all five, naming whoever drifted.
  const byHash = new Map();
  for (const f of found) {
    if (!byHash.has(f.hash)) byHash.set(f.hash, []);
    byHash.get(f.hash).push(`${f.label} (${f.file})`);
  }
  assert.equal(
    byHash.size,
    1,
    `sanitize block drift: expected 1 distinct block across ${found.length} consumers, found ${byHash.size}.\n` +
      [...byHash]
        .map(([h, labels]) => `  ${h} x${labels.length}: ${labels.join(', ')}`)
        .join('\n')
  );

  const [hash, drifted] = [...byHash][0];
  assert.equal(
    hash,
    SANITIZE_BLOCK_SHA256,
    `sanitize block no longer matches the hash pinned at fd75d62.\n` +
      `  expected: ${SANITIZE_BLOCK_SHA256}\n` +
      `  actual:   ${hash}\n` +
      `  consumers sharing the current block: ${drifted.join(', ')}`
  );

  // Byte-for-byte, not merely equal hashes.
  const [first, ...rest] = found;
  for (const f of rest) {
    assert.equal(
      f.block,
      first.block,
      `${f.label} (${f.file}) is not byte-identical to ${first.label} (${first.file})`
    );
  }
});
