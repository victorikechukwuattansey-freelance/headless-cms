'use strict';

const { EVIDENCE_CLASSES } = require('../prospect-model');

const VALID = new Set(EVIDENCE_CLASSES);

function classify(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    return { cls: 'UNKNOWN', valid: false };
  }
  const cls = String(evidence.cls || evidence.class || evidence.evidence_class || 'UNKNOWN').toUpperCase();
  if (!VALID.has(cls)) return { cls: 'UNKNOWN', valid: false };
  return { cls, valid: true };
}

function isAllowedClaim(cls, claimKind) {
  switch (claimKind) {
    case 'lead_volume':
      return cls === 'CLIENT_PROVIDED' || cls === 'VERIFIED';
    case 'revenue':
      return cls === 'CLIENT_PROVIDED' || cls === 'VERIFIED';
    case 'followup_gap':
      return false;
    case 'has_public_inquiry':
      return cls === 'OBSERVED';
    default:
      return false;
  }
}

module.exports = {
  classify,
  isAllowedClaim,
};
