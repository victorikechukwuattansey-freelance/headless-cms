/**
 * Deterministic fixtures. Derived from the engine's own sheets-seed CSVs and
 * TEST_PAYLOADS.json so tests and the offline report agree with the documented
 * contract without importing anything from the excluded `discovery` system.
 */
import { SheetStore } from './sheet-store.js';
import { loadWorkflow } from './contract.js';

export const SECRET = 'test-lead-engine-secret';
export const ADMIN_SECRET = 'test-admin-secret';

/** business_config rows exactly as sheets-seed/business_config.csv defines them. */
export const BUSINESS_CONFIG = [
  {
    business_id: 'biz_lonestar_hvac',
    business_name: 'Lone Star HVAC & Cooling',
    active: 'TRUE',
    owner_name: 'Jose Ramirez',
    owner_email: 'owner@lonestarhvac.example.com',
    reply_to_email: 'hello@lonestarhvac.example.com',
    from_email: 'no-reply@lonestarhvac.example.com',
    booking_link: 'https://book.lonestarhvac.example.com/?lead_id={{lead_id}}',
    business_secret: 'change-me-hvac-secret',
    followup_delay_hours: '24',
    max_followups: '3',
    timezone: 'America/Chicago',
    niche: 'HVAC',
    service_area: 'Austin, Round Rock, Cedar Park TX',
    default_message: 'Thanks! Lone Star HVAC will respond within 24 hours.',
    auto_customer_email: 'TRUE'
  },
  {
    business_id: 'biz_hillcountry_plumbing',
    business_name: 'Hill Country Plumbing',
    active: 'TRUE',
    owner_name: 'Dana Whitfield',
    owner_email: 'owner@hillcountryplumbing.example.com',
    reply_to_email: 'hello@hillcountryplumbing.example.com',
    from_email: 'no-reply@hillcountryplumbing.example.com',
    booking_link: '',
    business_secret: 'change-me-plumbing-secret',
    followup_delay_hours: '24',
    max_followups: '3',
    timezone: 'America/Chicago',
    niche: 'Plumbing',
    service_area: 'San Antonio, Boerne TX',
    default_message: 'We received your request and will call you back shortly.',
    auto_customer_email: 'FALSE'
  },
  {
    business_id: 'biz_deadwood_remodels',
    business_name: 'Deadwood Kitchen Remodels',
    active: 'FALSE',
    owner_name: 'Sam Ortiz',
    owner_email: 'owner@deadwoodremodel.example.com',
    reply_to_email: 'hello@deadwoodremodel.example.com',
    from_email: 'no-reply@deadwoodremodel.example.com',
    booking_link: '',
    business_secret: 'change-me-deadwood-secret',
    followup_delay_hours: '48',
    max_followups: '2',
    timezone: 'America/Chicago',
    niche: 'Remodeling',
    service_area: 'Dallas, TX',
    default_message: '',
    auto_customer_email: 'FALSE'
  }
];

/** Extra tenants required by TEST_PAYLOADS E02-E04 (owner/from email gate). */
export const OWNER_GATE_CONFIG = [
  {
    ...BUSINESS_CONFIG[0],
    business_id: 'biz_v43_e02_owner_no_from',
    business_name: 'E02 Owner No From',
    owner_email: 'owner@e02.example.com',
    from_email: ''
  },
  {
    ...BUSINESS_CONFIG[0],
    business_id: 'biz_v43_e03_no_owner',
    business_name: 'E03 No Owner',
    owner_email: '',
    from_email: 'no-reply@e03.example.com'
  },
  {
    ...BUSINESS_CONFIG[0],
    business_id: 'biz_v43_e04_none',
    business_name: 'E04 Neither',
    owner_email: '',
    from_email: ''
  }
];

/**
 * A pre-existing lead row, exactly as sheets-seed/leads.csv shows the sheet
 * looks in production. A real `leads` tab is never empty, and the engine's
 * duplicate check depends on reading at least one row, so every journey starts
 * from this baseline.
 */
export const HISTORICAL_LEAD = {
  lead_id: 'lead_1755693000001_a1b2c3d4',
  business_id: 'biz_lonestar_hvac',
  created_at: '2026-08-20T14:30:00.000Z',
  updated_at: '2026-08-20T14:31:00.000Z',
  source_type: 'web_form',
  source_id: 'wp-form-8841',
  name: 'Maria Gonzalez',
  phone: '(512) 555-0187',
  email: 'maria.gonzalez@example.com',
  message: 'AC stopped cooling last night, need repair ASAP',
  service: 'ac_repair',
  niche: 'HVAC',
  city: 'Austin',
  state: 'TX',
  zip: '78704',
  urgency: 'emergency',
  score: '95',
  status: 'new',
  booking_link: 'https://book.lonestarhvac.example.com/?lead_id=lead_1755693000001_a1b2c3d4',
  booking_link_sent: 'TRUE',
  booked: 'FALSE',
  followup_count: '0',
  next_followup_at: '2026-08-21T14:31:00.000Z',
  owner_notified: 'TRUE',
  idempotency_key: 'idem_1755693000001_k3j2h9xq',
  notes: ''
};

export function newStore({ extraConfig = true, withHistoricalLead = true } = {}) {
  const store = new SheetStore();
  for (const r of BUSINESS_CONFIG) store.append('business_config', r);
  if (extraConfig) for (const r of OWNER_GATE_CONFIG) store.append('business_config', r);
  if (withHistoricalLead) store.append('leads', HISTORICAL_LEAD);
  return store;
}

export function engineOptions(store, extra = {}) {
  return {
    sheets: store,
    vars: { LEAD_ENGINE_SECRET: SECRET },
    env: {
      LEAD_ENGINE_ADMIN_FROM: 'errors@lead-recovery-engine.example.com',
      LEAD_ENGINE_ADMIN_EMAIL: 'ops@lead-recovery-engine.example.com'
    },
    ...extra
  };
}

export const WF = {
  intake: () => loadWorkflow('01 - Lead Intake.json'),
  booking: () => loadWorkflow('02 - Booking Status.json'),
  callback: () => loadWorkflow('03 - Manual Callback Log.json'),
  status: () => loadWorkflow('04 - Status Update.json'),
  sweeper: () => loadWorkflow('05 - Follow-up Sweeper.json'),
  errorHandler: () => loadWorkflow('06 - Error Handler.json'),
  response: () => loadWorkflow('07 - Customer Response.json')
};

/** Wrap a TEST_PAYLOADS body the way the live webhook receives it. */
export function webhookInput(body, { secret = SECRET, query = {}, headers = {} } = {}) {
  return {
    headers: {
      'x-lead-engine-secret': secret,
      'content-type': 'application/json',
      ...headers
    },
    query,
    params: {},
    body,
    webhookUrl: '/webhook/test',
    executionMode: 'production'
  };
}

export function scheduleInput() {
  return {
    timestamp: new Date(0).toISOString(),
    'Readable date': new Date(0).toUTCString(),
    'Readable time': '00:00',
    'Timezone': 'America/Chicago',
    'Unix Timestamp': 0
  };
}
