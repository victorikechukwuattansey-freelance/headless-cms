'use strict';

const { sanitizeHtml } = require('./lib/validate');
const { isSuppressed } = require('./lib/suppress');

function buildOutreachBrief(record) {
  if (isSuppressed(record)) {
    return { ok: false, error: 'suppressed_prospect_no_brief' };
  }
  const e = (v) => sanitizeHtml(v);
  return {
    ok: true,
    brief: {
      prospect_id: e(record.prospect_id),
      business: e(record.business_name),
      industry: e(record.industry),
      location: `${e(record.city)}, ${e(record.state)}`.replace(/^,\s*$/, '').replace(/^\s*,/, ''),
      why_they_may_fit: e(record.recovery_signal || ''),
      observed_evidence: e(record.recovery_signal_evidence || ''),
      recovery_hypothesis:
        'Lead Recovery Engine helps businesses recover revenue from leads they already generated but failed to convert. ' +
        'This is a hypothesis based on observed signals; no claim is made about this business having abandoned leads.',
      personalization_points: e(record.research_notes || ''),
      offer_angle: 'Use the lead-recovery proposition: recover revenue from existing/acquired leads via consistent, low-risk follow-up.',
      call_to_action: 'Offer a no-obligation review of the business\'s current lead follow-up approach.',
      compliance_notes: e(
        isSuppressed(record)
          ? 'SUPPRESSED — no outreach.'
          : (record.contact_policy ||
              'Publicly available contact only; adhere to documented contact policy; honor opt-out. Not auto-sent.')
      ),
    },
  };
}

module.exports = {
  buildOutreachBrief,
};
