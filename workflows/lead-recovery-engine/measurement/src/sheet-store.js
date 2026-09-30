/**
 * In-memory Google Sheets emulator matching the engine's five tabs.
 *
 * Header sets are taken from the engine's own append/update mappings plus the
 * README/sheets-seed contract, and are asserted against the workflow JSON by
 * tests/workflow-contract.test.js. Values are stored as STRINGS because that is
 * what the Sheets API hands back to the engine's Code nodes (a real, load-bearing
 * property: the engine coerces with String()/Number() everywhere for this reason).
 *
 * Fault injection exists so the fail-closed tests can prove that a measurement or
 * side-effect failure cannot corrupt the lead lifecycle.
 */

export const HEADERS = {
  leads: [
    'lead_id', 'business_id', 'created_at', 'updated_at', 'source_type', 'source_id',
    'name', 'phone', 'email', 'message', 'service', 'niche', 'city', 'state', 'zip',
    'urgency', 'score', 'status', 'booking_link', 'booking_link_sent', 'booked',
    'booked_at', 'booking_id', 'owner_notified', 'followup_count',
    'next_followup_at', 'last_contact_at', 'last_customer_response_at',
    'idempotency_key', 'notes',
    // F16: consecutive-failed-follow-up counter. Bounded separately from
    // followup_count (which only ever counts SUCCESSFUL sends) so a transient
    // SMTP failure cannot burn the customer's real follow-up allowance, while
    // a permanently undeliverable address can still be retired.
    'followup_fail_count'
  ],
  business_config: [
    'business_id', 'business_name', 'active', 'owner_name', 'owner_email',
    'reply_to_email', 'from_email', 'booking_link', 'business_secret',
    'followup_delay_hours', 'max_followups', 'timezone', 'niche', 'service_area',
    'default_message', 'auto_customer_email'
  ],
  bookings: ['booking_id', 'lead_id', 'business_id', 'created_at', 'booking_at', 'source', 'status'],
  status_updates: ['update_id', 'created_at', 'lead_id', 'business_id', 'old_status', 'new_status', 'updated_by', 'notes'],
  errors: ['error_id', 'created_at', 'workflow', 'node', 'business_id', 'lead_id', 'error_message', 'execution_id', 'payload', 'resolved']
};

export class SheetStore {
  constructor(tabs) {
    /** @type {Map<string, object[]>} */
    this.tabs = new Map();
    this.faults = new Map();
    this.calls = [];
    for (const [name, headers] of Object.entries(HEADERS)) {
      this.tabs.set(name, (tabs && tabs[name] ? tabs[name].map((r) => ({ ...r })) : []));
      void headers;
    }
  }

  /**
   * Make `tab` fail on a given operation. Used to prove fail-closed behaviour.
   * @param {string} tab
   * @param {'read'|'append'|'update'} op
   * @param {Error} [err]
   */
  failOn(tab, op, err) {
    const k = `${tab}:${op}`;
    this.faults.set(k, err || new Error(`Injected ${op} failure on tab ${tab}`));
    return this;
  }

  clearFault(tab, op) {
    this.faults.delete(`${tab}:${op}`);
    return this;
  }

  _guard(tab, op) {
    const e = this.faults.get(`${tab}:${op}`);
    if (e) throw e;
  }

  rows(tab) {
    return this.tabs.get(tab) || [];
  }

  /** n8n googleSheets "read" with default options = every row, as an object. */
  read(tab) {
    this.calls.push({ op: 'read', tab });
    this._guard(tab, 'read');
    return this.rows(tab).map((r) => ({ ...r }));
  }

  append(tab, values) {
    this.calls.push({ op: 'append', tab, values });
    this._guard(tab, 'append');
    const row = {};
    for (const h of HEADERS[tab] || []) {
      const v = values[h];
      row[h] = v === undefined || v === null ? '' : String(v);
    }
    this.rows(tab).push(row);
    return [{ json: { ...row } }];
  }

  /**
   * n8n googleSheets "update" with columnToMatchOn. Default n8n behaviour is
   * removeExtraFields=false, i.e. a partial column update. Modelled here.
   */
  update(tab, matchColumn, matchValue, values) {
    this.calls.push({ op: 'update', tab, matchColumn, matchValue, values });
    this._guard(tab, 'update');
    const target = this.rows(tab).find((r) => String(r[matchColumn] ?? '') === String(matchValue ?? ''));
    if (!target) {
      const e = new Error(`No row in ${tab} where ${matchColumn}='${matchValue}'`);
      e.name = 'SheetRowNotFound';
      throw e;
    }
    for (const [k, v] of Object.entries(values)) {
      if (k === 'row_number') continue; // readOnly in the n8n v4 schema
      if (!HEADERS[tab].includes(k)) {
        throw new Error(`Column ${k} is not in the ${tab} header contract`);
      }
      target[k] = v === undefined || v === null ? '' : String(v);
    }
    return [{ json: { ...target } }];
  }

  seedBusinessConfig(csvRows) {
    for (const r of csvRows) this.append('business_config', r);
    return this;
  }

  seedTab(tab, rows) {
    for (const r of rows) this.append(tab, r);
    return this;
  }

  snapshot() {
    const out = {};
    for (const [name, rows] of this.tabs) out[name] = rows.map((r) => ({ ...r }));
    return out;
  }
}
