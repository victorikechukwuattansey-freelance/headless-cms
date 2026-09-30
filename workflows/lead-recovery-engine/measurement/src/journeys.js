/**
 * Realistic end-to-end journeys.
 *
 * Each journey drives the REAL workflow JSON through the harness and returns the
 * observed side effects (sheet rows, webhook responses, emails attempted, errors).
 * The same functions back both the test suite and the offline pilot report, so a
 * passing test and a published number can never disagree.
 *
 * Journeys A-I cover the nine realistic pilot cases. Everything asserted here is
 * an observation of engine behaviour, never an assumption about it.
 */
import { Engine } from './engine.js';
import { newStore, engineOptions, WF, webhookInput, scheduleInput, SECRET } from './fixtures.js';
import { withClock, hoursAfter } from './clock.js';

export const T0 = '2026-09-01T09:00:00.000Z';

function harness(store, wf, clock, extra = {}) {
  return new Engine(wf, engineOptions(store, { now: () => new Date(clock).getTime(), ...extra }));
}

function fire(store, wfKey, body, clock, extra = {}) {
  return withClock(clock, () => {
    const eng = harness(store, WF[wfKey](), clock, extra);
    eng.runAll(webhookInput(body, { secret: extra.secret || SECRET }));
    return eng;
  });
}

function sweep(store, clock, extra = {}) {
  return withClock(clock, () => {
    const eng = harness(store, WF.sweeper(), clock, extra);
    eng.runAll(scheduleInput());
    return eng;
  });
}

const intakeBody = (over = {}) => ({
  business_id: 'biz_lonestar_hvac',
  source_type: 'web_form',
  source_id: `src-${Math.random().toString(36).slice(2, 8)}`,
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

/* ------------------------------------------------------------------ *
 * A. New lead -> booked (WF01 -> WF02)
 * ------------------------------------------------------------------ */
export function journeyA_Booked() {
  const store = newStore();
  const intake = fire(store, 'intake', intakeBody({ source_id: 'journey-a' }), T0);
  const lead = store.rows('leads').find((r) => r.source_id === 'journey-a');
  if (!lead) throw new Error('Journey A: lead was not persisted');

  const booking = fire(
    store,
    'booking',
    { business_id: 'biz_lonestar_hvac', lead_id: lead.lead_id, booking_id: 'bk_a1', status: 'confirmed' },
    hoursAfter(T0, 3)
  );

  return {
    id: 'A',
    name: 'New lead books within 3 hours',
    store,
    leadId: lead.lead_id,
    intakeResponse: intake.response(),
    bookingResponse: booking.response(),
    leadAfter: store.rows('leads').find((r) => r.lead_id === lead.lead_id),
    bookings: store.rows('bookings'),
    statusUpdates: store.rows('status_updates'),
    emails: [...intake.outbox, ...booking.outbox],
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * B. New lead -> no response (WF01 -> WF05 x3)
 * ------------------------------------------------------------------ */
export function journeyB_NoResponse() {
  const store = newStore();
  const intake = fire(store, 'intake', intakeBody({ source_id: 'journey-b' }), T0);
  const lead = store.rows('leads').find((r) => r.source_id === 'journey-b');
  if (!lead) throw new Error('Journey B: lead was not persisted');

  const sweeps = [];
  // followup_delay_hours = 24, max_followups = 3
  for (let i = 1; i <= 4; i += 1) {
    sweeps.push(sweep(store, hoursAfter(T0, 24 * i)));
  }

  return {
    id: 'B',
    name: 'New lead never responds, exhausts follow-ups',
    store,
    leadId: lead.lead_id,
    intakeResponse: intake.response(),
    leadAfter: store.rows('leads').find((r) => r.lead_id === lead.lead_id),
    sweepEmails: sweeps.flatMap((s) => s.outbox),
    sweeps: sweeps.map((s) => ({ candidates: s.outputsOf('Select Follow-up Candidates').length, emails: s.outbox.length })),
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * C. Manual callback logged (WF03)
 * ------------------------------------------------------------------ */
export function journeyC_Callback() {
  const store = newStore();
  const res = fire(
    store,
    'callback',
    {
      business_id: 'biz_lonestar_hvac',
      name: 'Jordan Ellis',
      phone: '512-555-0188',
      email: 'JORDAN.ELLIS@example.com',
      message: 'Owner called back, asked for Saturday appointment.',
      service: 'HVAC',
      callback_notes: 'Spoke with customer, wants Saturday morning.'
    },
    hoursAfter(T0, 6)
  );
  return {
    id: 'C',
    name: 'Manual callback logged out of band',
    store,
    response: res.response(),
    leads: store.rows('leads'),
    statusUpdates: store.rows('status_updates'),
    emails: res.outbox,
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * D. Manual status update -> lost (WF04)
 * ------------------------------------------------------------------ */
export function journeyD_StatusUpdate() {
  const store = newStore();
  const intake = fire(store, 'intake', intakeBody({ source_id: 'journey-d' }), T0);
  const lead = store.rows('leads').find((r) => r.source_id === 'journey-d');

  const update = fire(
    store,
    'status',
    {
      business_id: 'biz_lonestar_hvac',
      lead_id: lead.lead_id,
      new_status: 'lost',
      updated_by: 'front_desk',
      notes: 'Went with a competitor.'
    },
    hoursAfter(T0, 8)
  );

  const updateAgain = fire(
    store,
    'status',
    {
      business_id: 'biz_lonestar_hvac',
      lead_id: lead.lead_id,
      new_status: 'qualified',
      updated_by: 'front_desk'
    },
    hoursAfter(T0, 9)
  );

  const invalidStatus = fire(
    store,
    'status',
    {
      business_id: 'biz_lonestar_hvac',
      lead_id: lead.lead_id,
      new_status: 'not_a_status',
      updated_by: 'front_desk'
    },
    hoursAfter(T0, 9.5)
  );

  return {
    id: 'D',
    name: 'Manual status update to lost, then a rejected terminal update',
    store,
    leadId: lead.lead_id,
    intakeResponse: intake.response(),
    firstResponse: update.response(),
    secondResponse: updateAgain.response(),
    invalidStatusResponse: invalidStatus.response(),
    leadAfter: store.rows('leads').find((r) => r.lead_id === lead.lead_id),
    statusUpdates: store.rows('status_updates'),
    emails: [...intake.outbox, ...update.outbox, ...updateAgain.outbox, ...invalidStatus.outbox],
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * E. Customer replies (WF07)
 * ------------------------------------------------------------------ */
export function journeyE_CustomerResponse() {
  const store = newStore();
  const intake = fire(store, 'intake', intakeBody({ source_id: 'journey-e' }), T0);
  const lead = store.rows('leads').find((r) => r.source_id === 'journey-e');

  const res = fire(
    store,
    'response',
    {
      business_id: 'biz_lonestar_hvac',
      lead_id: lead.lead_id,
      message: 'Yes, Saturday morning works for me.',
      channel: 'email_reply'
    },
    hoursAfter(T0, 5)
  );

  return {
    id: 'E',
    name: 'Customer replies, follow-up suppressed',
    store,
    leadId: lead.lead_id,
    response: res.response(),
    leadAfter: store.rows('leads').find((r) => r.lead_id === lead.lead_id),
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * F. Duplicate submissions (WF01 idempotency)
 * ------------------------------------------------------------------ */
export function journeyF_Duplicates() {
  const store = newStore();
  const body = intakeBody({
    source_id: 'journey-f',
    idempotency_key: 'journey-f-key',
    name: 'Jordan Ellis',
    phone: '(512) 555-0188',
    email: '  JORDAN.ELLIS@EXAMPLE.COM  '
  });

  const first = fire(store, 'intake', body, T0);
  const second = fire(store, 'intake', body, hoursAfter(T0, 0.01));
  const bySource = fire(store, 'intake', intakeBody({ source_id: 'journey-f', phone: '5125559999' }), hoursAfter(T0, 0.02));

  return {
    id: 'F',
    name: 'Same lead submitted three ways',
    store,
    responses: [first.response(), second.response(), bySource.response()],
    leads: store.rows('leads').filter((r) => r.business_id === 'biz_lonestar_hvac' && r.source_id === 'journey-f'),
    leadCount: store.rows('leads').length,
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * G. Rejected requests (401/400/403/404)
 * ------------------------------------------------------------------ */
export function journeyG_Rejections() {
  const store = newStore();
  const results = {};

  results.wrongSecret = fire(store, 'intake', intakeBody(), T0, { secret: 'nope' }).response();
  results.missingBusinessId = fire(store, 'intake', { name: 'No Biz', email: 'x@example.com' }, T0).response();
  results.unknownBusiness = fire(store, 'intake', intakeBody({ business_id: 'biz_nope' }), T0).response();
  results.inactiveBusiness = fire(store, 'intake', intakeBody({ business_id: 'biz_deadwood_remodels' }), T0).response();

  const seed = store.rows('leads').find((r) => r.lead_id === 'lead_1755693000001_a1b2c3d4');
  results.unknownLeadBooking = fire(
    store,
    'booking',
    { business_id: 'biz_lonestar_hvac', lead_id: 'lead_does_not_exist', booking_id: 'bk_g1' },
    hoursAfter(T0, 2)
  ).response();
  results.unknownLeadResponse = fire(
    store,
    'response',
    { business_id: 'biz_lonestar_hvac', lead_id: 'lead_does_not_exist', message: 'hi' },
    hoursAfter(T0, 2)
  ).response();
  results.invalidStatus = fire(
    store,
    'status',
    { business_id: 'biz_lonestar_hvac', lead_id: seed.lead_id, new_status: 'not_a_status' },
    hoursAfter(T0, 2)
  ).response();
  results.missingRefBooking = fire(store, 'booking', { business_id: 'biz_lonestar_hvac' }, hoursAfter(T0, 2)).response();

  return {
    id: 'G',
    name: 'Rejected and unauthenticated requests',
    store,
    results,
    leads: store.rows('leads'),
    statusUpdates: store.rows('status_updates'),
    errors: store.rows('errors')
  };
}

/* ------------------------------------------------------------------ *
 * H. Failure isolation
 * ------------------------------------------------------------------ */
export function journeyH_Failures() {
  const store = newStore();

  // H1: follow-up email fails -> is the failure recorded anywhere?
  // F16: this used to dead-end at a noOp, so a persistently failing address was
  // re-selected every hour forever. It must now record the error, count the
  // consecutive failure, and keep retrying until the ceiling retires the lead.
  const failEmailStore = newStore();
  const intake = fire(failEmailStore, 'intake', intakeBody({ source_id: 'journey-h1' }), T0);
  const alwaysFails = { emailFault: () => new Error('SMTP 550 mailbox unavailable') };
  const failedSweep = sweep(failEmailStore, hoursAfter(T0, 24), alwaysFails);

  const leadAfterFirstFailure = () => {
    const l = failEmailStore.rows('leads').find((r) => r.source_id === 'journey-h1');
    return {
      status: l.status,
      followup_count: l.followup_count,
      followup_fail_count: l.followup_fail_count,
      next_followup_at: l.next_followup_at
    };
  };
  const afterFirstFailure = leadAfterFirstFailure();

  // Snapshot the first sweep's errors rows before the extra sweeps add more,
  // so this journey stays readable. Both due leads fail, so there are two.
  const errorsAfterFirstSweep = failEmailStore.rows('errors').map((r) => ({ ...r }));

  // Drive the same lead to the ceiling. The business default is max_followups
  // 3, so the floor of 24 applies; 24 more failing sweeps reach it.
  for (let i = 0; i < 24; i += 1) sweep(failEmailStore, hoursAfter(T0, 48 + i), alwaysFails);
  const afterCeiling = leadAfterFirstFailure();

  // A healthy transient failure: one failing sweep then a successful one.
  const transientStore = newStore();
  fire(transientStore, 'intake', intakeBody({ source_id: 'journey-h2' }), T0);
  sweep(transientStore, hoursAfter(T0, 24), alwaysFails);
  const transientLead = () => {
    const l = transientStore.rows('leads').find((r) => r.source_id === 'journey-h2');
    return {
      status: l.status,
      followup_count: l.followup_count,
      followup_fail_count: l.followup_fail_count
    };
  };
  const afterTransientFailure = transientLead();
  const recoverySweep = sweep(transientStore, hoursAfter(T0, 48), {});
  const afterRecovery = transientLead();

  // H2: Sheets append fails -> does the engine falsely report success?
  const downStore = newStore();
  downStore.failOn('leads', 'append', new Error('Sheets API 503'));

  return {
    id: 'H',
    name: 'Side-effect failures are isolated or swallowed',
    store: failEmailStore,
    intakeResponse: intake.response(),
    followupSendAttempted: failedSweep.outbox.length,
    followupSendFailed: failedSweep.outbox.filter((e) => !e.sent).length,
    // F16: the failed send is now recorded, so this is no longer empty. The
    // first sweep alone is shown - 24 further failing sweeps follow below.
    errorsAfterFailedSend: errorsAfterFirstSweep,
    // F16: a failure must count WITHOUT consuming the customer's real
    // follow-up allowance, and must not retire the lead early.
    afterFirstFailure,
    afterCeiling,
    afterTransientFailure,
    afterRecovery,
    recoverySendSucceeded: recoverySweep.outbox.every((e) => e.sent),
    sheetsDown: { store: downStore }
  };
}

/* ------------------------------------------------------------------ *
 * I. Multi-tenant isolation
 * ------------------------------------------------------------------ */
export function journeyI_Tenants() {
  const store = newStore();
  const hvac = fire(store, 'intake', intakeBody({ source_id: 'shared-id', business_id: 'biz_lonestar_hvac' }), T0);
  const plumbing = fire(
    store,
    'intake',
    intakeBody({
      source_id: 'shared-id',
      business_id: 'biz_hillcountry_plumbing',
      idempotency_key: 'shared-key',
      name: 'Sam Kline',
      phone: '2105550123',
      email: 'sam.kline@example.com'
    }),
    hoursAfter(T0, 0.5)
  );

  return {
    id: 'I',
    name: 'Same source_id and idempotency_key across two tenants',
    store,
    responses: [hvac.response(), plumbing.response()],
    leads: store.rows('leads').filter((r) => r.source_id === 'shared-id'),
    errors: store.rows('errors')
  };
}

export const ALL_JOURNEYS = [
  journeyA_Booked,
  journeyB_NoResponse,
  journeyC_Callback,
  journeyD_StatusUpdate,
  journeyE_CustomerResponse,
  journeyF_Duplicates,
  journeyG_Rejections,
  journeyH_Failures,
  journeyI_Tenants
];

export function runAllJourneys() {
  return ALL_JOURNEYS.map((fn) => fn());
}
