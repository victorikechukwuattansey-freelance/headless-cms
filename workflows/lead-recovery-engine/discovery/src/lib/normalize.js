'use strict';

function normalizeDomain(value) {
  if (!value) return '';
  let v = String(value).trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, '');
  v = v.replace(/^www\./, '');
  v = v.split('/')[0];
  v = v.split('?')[0];
  v = v.split('#')[0];
  v = v.split('@').pop();
  v = v.replace(/\.+$/, '');
  return v;
}

function normalizePhone(value) {
  if (value == null) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1);
  if (digits.length === 10) return digits;
  return '';
}

function normalizeEmail(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function normalizeIdentityToken(parts) {
  return parts
    .filter((p) => typeof p === 'string' && p.trim() !== '')
    .map((p) => p.trim().toLowerCase())
    .join('|');
}

function normalizeName(value) {
  if (!value) return '';
  return String(value)
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

module.exports = {
  normalizeDomain,
  normalizePhone,
  normalizeEmail,
  normalizeIdentityToken,
  normalizeName,
};
