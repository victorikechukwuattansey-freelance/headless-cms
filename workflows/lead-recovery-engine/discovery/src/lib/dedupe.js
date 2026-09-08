'use strict';

const { normalizeDomain, normalizePhone, normalizeName } = require('./normalize');

function normalizeForMatch(record) {
  const name = normalizeName(record.business_name || '');
  const city = String(record.city || '').trim().toLowerCase();
  const state = String(record.state || '').trim().toLowerCase();
  const phone = normalizePhone(record.phone || '');
  const domain = normalizeDomain(record.website || record.domain || '');
  return { name, city, state, phone, domain };
}

function matchResult(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);

  if (na.domain && nb.domain && na.domain === nb.domain) {
    return { isDuplicate: true, confidence: 'high', reason: 'domain' };
  }

  if (
    na.phone &&
    nb.phone &&
    na.phone === nb.phone &&
    na.state &&
    nb.state &&
    na.state === nb.state
  ) {
    return { isDuplicate: true, confidence: 'high', reason: 'phone' };
  }

  if (
    na.name &&
    nb.name &&
    na.name === nb.name &&
    na.city &&
    nb.city &&
    na.city === nb.city &&
    na.state &&
    nb.state &&
    na.state === nb.state
  ) {
    return { isDuplicate: true, confidence: 'medium', reason: 'business_name_plus_location' };
  }

  if (na.name && nb.name && na.name === nb.name && na.state && nb.state && na.state === nb.state) {
    return { isDuplicate: true, confidence: 'low', reason: 'business_name_plus_state' };
  }

  if (
    na.name &&
    nb.name &&
    na.name === nb.name &&
    na.state &&
    nb.state &&
    na.state !== nb.state
  ) {
    return { isDuplicate: false, confidence: 'low', reason: 'same_name_different_state' };
  }

  return { isDuplicate: false, confidence: 'none', reason: 'no_match' };
}

function matchAgainstKnown(record, known) {
  const candidates = [];
  for (const existing of known) {
    const res = matchResult(record, existing);
    if (res.isDuplicate) {
      candidates.push({ existing, ...res });
    }
  }
  if (candidates.length === 0) {
    return { duplicate: false, reason: 'no_match', existing: null };
  }
  const best = candidates.sort((x, y) => {
    const rank = { high: 3, medium: 2, low: 1, none: 0 };
    return rank[y.confidence] - rank[x.confidence];
  })[0];
  return {
    duplicate: true,
    reason: best.reason,
    confidence: best.confidence,
    existing: best.existing,
    ambiguous: best.confidence === 'low',
  };
}

module.exports = {
  normalizeForMatch,
  matchResult,
  matchAgainstKnown,
};
