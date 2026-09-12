'use strict';

const VERIFIED_COLUMNS = [
  'lead_id',
  'business_name',
  'niche',
  'city',
  'state',
  'country',
  'address',
  'phone',
  'website',
  'rating',
  'review_count',
  'google_maps_url',
  'business_type',
  'source',
  'search_input_id',
  'dedupe_key',
  'has_website',
  'has_phone',
  'target_niche',
  'score',
  'qualification_status',
  'verified_at',
  'notes',
  'manual_review_notes',
];

const APPROVED_COLUMNS = [
  'lead_id',
  'business_name',
  'niche',
  'city',
  'state',
  'country',
  'website',
  'phone',
  'email',
  'contact_name',
  'contact_title',
  'email_source',
  'email_verified',
  'contact_form',
  'linkedin_url',
  'lead_score',
  'qualification_status',
  'outreach_channel',
  'outreach_status',
  'approved_at',
  'notes',
];

const VERIFIED_COLUMN_INDEX = Object.fromEntries(VERIFIED_COLUMNS.map((c, i) => [c, i]));
const APPROVED_COLUMN_INDEX = Object.fromEntries(APPROVED_COLUMNS.map((c, i) => [c, i]));

const VERIFIED_FORMULA_COLUMNS = [
  'has_website',
  'has_phone',
  'target_niche',
  'score',
  'qualification_status',
];

const FORMULA_COLUMN_SET = new Set(VERIFIED_FORMULA_COLUMNS);

const SOURCE_INTEGRITY_FIELDS = [
  'lead_id',
  'business_name',
  'qualification_status',
  'score',
  'dedupe_key',
  'verified_at',
];

const CLEANUP_NAMESPACE = 'TEST-AOH';
const CLEANUP_REGEX = /^TEST-AOH-\d+$/;

const CONTROL_FIELD_NAMES = ['_control', '_noNewApproved'];

function rowToObject(row, columns) {
  const obj = {};
  for (let i = 0; i < columns.length; i += 1) {
    obj[columns[i]] = row[i] === undefined || row[i] === null ? '' : String(row[i]);
  }
  return obj;
}

function objectToRow(obj, columns) {
  return columns.map((c) => (obj[c] === undefined || obj[c] === null ? '' : String(obj[c])));
}

function normalize(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function isHeaderRow(row) {
  return row[0] === 'lead_id';
}

function isControlName(name) {
  return CONTROL_FIELD_NAMES.includes(name);
}

module.exports = {
  VERIFIED_COLUMNS,
  APPROVED_COLUMNS,
  VERIFIED_COLUMN_INDEX,
  APPROVED_COLUMN_INDEX,
  VERIFIED_FORMULA_COLUMNS,
  FORMULA_COLUMN_SET,
  SOURCE_INTEGRITY_FIELDS,
  CLEANUP_NAMESPACE,
  CLEANUP_REGEX,
  CONTROL_FIELD_NAMES,
  rowToObject,
  objectToRow,
  normalize,
  isHeaderRow,
  isControlName,
};