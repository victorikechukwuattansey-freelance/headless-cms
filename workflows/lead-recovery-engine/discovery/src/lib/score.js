'use strict';

const { classify, isAllowedClaim } = require('./evidence');

const FACTORS = [
  { key: 'appointment_dependency', label: 'Appointment-driven service', weight: 20, source: 'INFERRED' },
  { key: 'inbound_lead_dependency', label: 'Relies on inbound inquiries', weight: 20, source: 'INFERRED' },
  { key: 'service_ticket_value', label: 'Per-service/customer value', weight: 15, source: 'INFERRED' },
  { key: 'business_scale', label: 'Business scale', weight: 10, source: 'INFERRED' },
  { key: 'service_area', label: 'Service-area characteristics', weight: 10, source: 'OBSERVED' },
  { key: 'manual_inquiry_handling', label: 'Manual inbound inquiry handling', weight: 10, source: 'OBSERVED' },
  { key: 'followup_operational_difficulty', label: 'Follow-up may be difficult operationally', weight: 10, source: 'INFERRED' },
  { key: 'model_fit', label: 'Fit with LRE delivery model', weight: 15, source: 'INFERRED' },
];

const SIGNAL_STRENGTH = {
  strong: { min: 70, label: 'strong' },
  medium: { min: 45, label: 'medium' },
  weak: { min: 0, label: 'weak' },
};

function strengthOf(score) {
  for (const [k, v] of Object.entries(SIGNAL_STRENGTH)) {
    if (score >= v.min) return v.label;
  }
  return 'weak';
}

function sumWeights(flags) {
  return FACTORS.reduce((sum, f) => (flags[f.key] ? sum + f.weight : sum), 0);
}

function score(record, flags, evidence) {
  const ev = classify(evidence);
  const allowedVolume = isAllowedClaim(ev.cls, 'lead_volume');
  const allowedRevenue = isAllowedClaim(ev.cls, 'revenue');

  if (record && (allowedVolume || allowedRevenue)) {
    return {
      score: 0,
      strength: 'weak',
      reason: 'CLIENT-PROVIDED/VERIFIED lead-volume or revenue present; requires client-context score, not prospecting score.',
      factors: [],
    };
  }

  const raw = sumWeights(flags);
  const scoreValue = Math.max(0, Math.min(100, raw));
  const parts = FACTORS.filter((f) => flags[f.key]).map((f) => f.label);
  const reason = parts.length
    ? `Prospecting signal: ${parts.join('; ')}. Opportunity score is an inference, not a claim of abandoned leads.`
    : 'Insufficient observed signals to assign a meaningful prospecting score.';

  return {
    score: scoreValue,
    strength: strengthOf(scoreValue),
    reason,
    factors: FACTORS.filter((f) => flags[f.key]).map((f) => ({ key: f.key, label: f.label, weight: f.weight })),
  };
}

module.exports = {
  FACTORS,
  score,
  strengthOf,
};
