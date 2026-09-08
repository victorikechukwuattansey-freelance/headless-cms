'use strict';

const path = require('path');
const { loadCsv, saveCsv, asProspectRecord } = require('./store');
const { transition } = require('./lib/states');
const { isSuppressed, suppress } = require('./lib/suppress');

function loadStore(filePath) {
  return loadCsv(filePath).map(asProspectRecord);
}

function saveStore(filePath, rows) {
  return saveCsv(filePath, rows);
}

function findById(rows, id) {
  return rows.find((r) => r.prospect_id === id) || null;
}

function reviewApproval(queue, id) {
  const rec = findById(queue, id);
  if (!rec) return { ok: false, error: 'not_found' };
  if (rec.research_status === 'approved' || rec.research_status === 'outreach_ready') {
    return { ok: true, value: rec };
  }
  try {
    transition(rec, 'approved');
  } catch (_) {
    if (rec.research_status !== 'needs_review') transition(rec, 'needs_review');
    transition(rec, 'approved');
  }
  return { ok: true, value: rec };
}

function reviewRejected(queue, id, reason) {
  const rec = findById(queue, id);
  if (!rec) return { ok: false, error: 'not_found' };
  rec.research_notes = (rec.research_notes ? rec.research_notes + ' | ' : '') + `REJECTED:${reason}`;
  if (rec.research_status !== 'needs_review') transition(rec, 'needs_review');
  rec.rejected = true;
  return { ok: true, value: rec };
}

function reviewSuppressed(queue, id, reason, now) {
  const rec = findById(queue, id);
  if (!rec) return { ok: false, error: 'not_found' };
  suppress(rec, reason, now);
  return { ok: true, value: rec };
}

function reachOutreachReady(queue, id) {
  const rec = findById(queue, id);
  if (!rec) return { ok: false, error: 'not_found' };
  if (isSuppressed(rec)) return { ok: false, error: 'suppressed' };
  try {
    transition(rec, 'outreach_ready');
  } catch (_) {
    if (rec.research_status !== 'approved') reviewApproval(queue, id);
    transition(rec, 'outreach_ready');
  }
  return { ok: true, value: rec };
}

module.exports = {
  loadStore,
  saveStore,
  findById,
  reviewApproval,
  reviewRejected,
  reviewSuppressed,
  reachOutreachReady,
};

const DEFAULT_STORE_PATH = () =>
  path.join(__dirname, '..', 'data', 'prospects.csv');

module.exports.DEFAULT_STORE_PATH = DEFAULT_STORE_PATH;
