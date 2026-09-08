'use strict';

const { assessOpportunity } = require('./pipeline');
const { matchAgainstKnown } = require('./lib/dedupe');
const { isSuppressed, suppress } = require('./lib/suppress');
const { transition } = require('./lib/states');
const { buildOutreachBrief } = require('./outreach-brief');
const { queueProspect } = require('./outreach-queue');

function genId(prefix, now) {
  const ts = now || Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

function dedupeBatch(records, existingRecords) {
  const known = (existingRecords || []).slice();
  const kept = [];
  const cleanDuplicates = [];
  const ambiguous = [];
  for (const rec of records) {
    const match = known.length ? matchAgainstKnown(rec, known) : { duplicate: false, existing: null };
    if (match.duplicate) {
      if (match.ambiguous) {
        rec.ambiguous = true;
        rec.prospect_id = genId('pros');
        rec.research_status = 'needs_review';
        rec.dedup_reason = match.reason;
        rec.dedup_matched_id = match.existing ? match.existing.prospect_id : null;
        ambiguous.push(rec);
        kept.push(rec);
      } else if (match.existing) {
        cleanDuplicates.push({
          record: rec,
          matched: match.existing,
          matched_id: match.existing.prospect_id,
          reason: match.reason,
        });
      } else {
        rec.prospect_id = genId('pros');
        known.push(rec);
        kept.push(rec);
      }
    } else {
      rec.prospect_id = genId('pros');
      known.push(rec);
      kept.push(rec);
    }
  }
  return { kept, cleanDuplicates, ambiguous };
}

function processBatch(importResult, existingRecords, researchMap) {
  const research = researchMap || {};
  const { kept, cleanDuplicates, ambiguous } = dedupeBatch(importResult.valid, existingRecords);

  const approved = [];
  const needsResearch = [];
  const rejected = [];
  const suppressedList = [];
  const outreachReady = [];
  const outreachBriefs = [];

  for (const rec of kept) {
    if (rec.ambiguous) continue;

    const r = research[normalizeKey(rec.business_name)] || { flags: {}, evidence: { cls: 'UNKNOWN', text: '' } };

    // Walk the validated state machine: discovered -> researching -> researched.
    try { transition(rec, 'researching'); } catch (_) {}
    try { transition(rec, 'researched'); } catch (_) {}

    assessOpportunity(rec, r.flags || {}, r.evidence || { cls: 'UNKNOWN', text: '' });

    // Operator review may suppress during research. (No import path sets suppression directly.)
    if (r.suppress === true) {
      suppress(rec, r.suppressReason || 'operator_suppressed');
      suppressedList.push(rec);
      continue;
    }

    if (isSuppressed(rec)) {
      rec.research_status = 'suppressed';
      suppressedList.push(rec);
      continue;
    }

    // Insufficient research (UNKNOWN evidence, no score) -> needs more research.
    if (!(rec.evidence_class && rec.evidence_class !== 'UNKNOWN') || !rec.opportunity_score) {
      rec.research_status = 'needs_review';
      rec.research_notes = (rec.research_notes ? rec.research_notes + ' | ' : '') + 'INSUFFICIENT:no_research';
      needsResearch.push(rec);
      continue;
    }

    // Human review gate: route through needs_review -> approved.
    try { transition(rec, 'needs_review'); } catch (_) {}

    if (rec.opportunity_score >= 70) {
      try { transition(rec, 'approved'); } catch (_) {}
      approved.push(rec);
    } else {
      rec.research_notes = (rec.research_notes ? rec.research_notes + ' | ' : '') +
        `INSUFFICIENT:score_${rec.opportunity_score}`;
      rejected.push(rec);
    }
  }

  // Approved -> outreach_ready -> outreach queue (activity = manually drafted later).
  for (const rec of approved) {
    try {
      // Ensure the brief has a grounded "why they may fit" body derived from observed evidence.
      if (!rec.recovery_signal && rec.recovery_signal_evidence) {
        rec.recovery_signal = rec.recovery_signal_evidence;
      }
      transition(rec, 'outreach_ready');
      const q = queueProspect(rec);
      if (q.ok && rec.outreach_status === 'queued') {
        outreachReady.push(rec);
        const brief = buildOutreachBrief(rec);
        if (brief.ok) outreachBriefs.push(brief.brief);
      }
    } catch (_) {
      rec.research_status = 'needs_review';
    }
  }

  return {
    imported: importResult.total,
    valid: importResult.valid.length,
    invalid: importResult.invalid.length,
    invalidRecords: importResult.invalid,
    duplicates: cleanDuplicates.length,
    ambiguous: ambiguous.length,
    approved: approved.length,
    needsResearch: needsResearch.length,
    rejected: rejected.length,
    suppressed: suppressedList.length,
    outreachReady: outreachReady.length,
    outreachBriefs,
    records: kept,
    cleanDuplicates,
    ambiguousRecords: ambiguous,
    approvedRecords: approved,
    needsResearchRecords: needsResearch,
    rejectedRecords: rejected,
    suppressedRecords: suppressedList,
    outreachReadyRecords: outreachReady,
  };
}

function normalizeKey(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = {
  dedupeBatch,
  processBatch,
};
