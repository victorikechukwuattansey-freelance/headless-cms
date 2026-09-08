'use strict';

const { getProspect, updateProspect, listProspects } = require('./store');
const {
  reviewApproval,
  reviewRejected,
  reviewSuppressed,
  reachOutreachReady,
} = require('./queue');
const { buildOutreachBrief } = require('./outreach-brief');
const { assessOpportunity } = require('./pipeline');
const { classify } = require('./lib/evidence');
const { FACTORS } = require('./lib/score');
const { EVIDENCE_CLASSES } = require('./prospect-model');
const { suppress } = require('./lib/suppress');

// Load the canonical prospect for review. Re-reads from disk so the operator
// never acts on stale in-memory state.
function loadProspect(file, id) {
  return getProspect(file, id);
}

// Apply a review decision to the canonical record and persist it atomically via
// the canonical store API (getProspect -> mutate -> updateProspect). Returns
// { ok, value } on success or { ok:false, error } on failure. Nothing is
// reported as successful until the atomic write returns.
function reviewAndPersist(file, id, op, reason, now) {
  if (!id) return { ok: false, error: 'missing_id' };
  const rec = getProspect(file, id);
  if (!rec) return { ok: false, error: 'not_found' };

  const ts = now || new Date().toISOString();

  let res;
  try {
    switch (op) {
      case 'approve':
        res = reviewApproval([rec], id);
        break;
      case 'reject':
        res = reviewRejected([rec], id, reason || 'other');
        break;
      case 'suppress':
        res = reviewSuppressed([rec], id, reason || 'operator', ts);
        break;
      case 'ready':
        res = reachOutreachReady([rec], id);
        break;
      default:
        return { ok: false, error: `unknown_op:${op}`, value: rec };
    }
  } catch (e) {
    // The validated mutators may throw (e.g. suppressed_is_terminal). Surface as
    // an explicit failure rather than an uncaught exception.
    return { ok: false, error: 'invalid_transition', detail: String((e && e.message) || e), value: rec };
  }

  if (!res.ok) return { ok: false, error: res.error, value: rec };

  const value = res.value;
  // Audit stamp: record when the review action occurred. This is a wrapper-level
  // convention; the validated mutators still own the actual state transition.
  value.updated_at = ts;

  let saved;
  try {
    saved = updateProspect(file, value);
  } catch (e) {
    // Atomic write failed. The store is untouched; never report success.
    return { ok: false, error: 'persist_failed', detail: String((e && e.message) || e), value };
  }
  if (!saved) return { ok: false, error: 'persist_failed', value };
  return { ok: true, value: saved };
}

function reviewBrief(file, id) {
  const rec = getProspect(file, id);
  if (!rec) return { ok: false, error: 'not_found' };
  const b = buildOutreachBrief(rec);
  if (!b.ok) return { ok: false, error: b.error };
  return { ok: true, value: b.brief };
}

// Parse the canonical `research_evidence` column (a JSON array of evidence
// items, each `{ text, class, source, at }`). Defensive: any corruption falls
// back to an empty list rather than throwing.
function parseResearchEvidence(rec) {
  if (!rec || !rec.research_evidence) return [];
  const raw = String(rec.research_evidence).trim();
  if (!raw || raw === '[]') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

// The known score-factor keys (labels/weights), reused verbatim from lib/score.
const FACTOR_KEYS = FACTORS.map((f) => f.key);

// Normalize an operator-supplied evidence classification. Only the repository's
// exact evidence vocabulary is accepted (OBSERVED / INFERRED / CLIENT_PROVIDED /
// VERIFIED / UNKNOWN). An invalid class is surfaced as an error — it is never
// silently upgraded, and an INFERRED item can never become something stronger.
function normalizeEvidenceClass(value) {
  const cls = String(value || '').toUpperCase().replace(/[^A-Z_]/g, '');
  if (!EVIDENCE_CLASSES.includes(cls)) return null;
  return cls;
}

// Operator-assisted research entry + re-scoring. This is the Pass 6 research
// path:
//
//   LOAD canonical prospect (fresh from disk)
//   → APPEND one classified evidence item to research_evidence (canonical column)
//   → RE-RUN the existing validated scorer (assessOpportunity) on the selected flags
//   → STAMP updated_at
//   → ATOMIC PERSIST single record (updateProspect)
//   → CONFIRM — or explicit failure (invalid_input / persist_failed)
//
// It NEVER changes research_status (so research can raise a score without
// approving or making the prospect outreach-ready), NEVER removes suppression,
// and NEVER sends outreach. Research entry is allowed on a suppressed prospect
// only as metadata update — suppression fields are never touched.
//
// opts: {
//   flags: { <factorKey>: true, ... }   -> scoring flags supported by the evidence
//   evidence: { text, class, source }   -> one new evidence finding
//   note: string                        -> optional research note (appended)
// }
function researchAndPersist(file, id, opts, now) {
  if (!id) return { ok: false, error: 'missing_id' };
  const rec = getProspect(file, id);
  if (!rec) return { ok: false, error: 'not_found' };

  const o = opts || {};
  const ts = now || new Date().toISOString();
  const flags = o.flags || {};
  const evidence = o.evidence || {};

  // Validate scoring flags against the exact factor vocabulary.
  for (const k of Object.keys(flags)) {
    if (!FACTOR_KEYS.includes(k)) return { ok: false, error: `invalid_flag:${k}`, value: rec };
  }

  // Validate + normalize the evidence classification. Never upgraded.
  const cls = normalizeEvidenceClass(evidence.class);
  if (cls === null) {
    return { ok: false, error: 'invalid_evidence_class', detail: String(evidence.class || ''), value: rec };
  }

  // Normalize this call's scoring flags into an ordered array of factor keys.
  const newFlagKeys = Object.keys(flags)
    .filter((k) => FACTOR_KEYS.includes(k))
    .sort();

  // Canonical evidence list (persisted distinct classifications per item). Each
  // item records which scoring factors its evidence supports.
  const items = parseResearchEvidence(rec);
  const itemText = String(evidence.text == null ? '' : evidence.text).trim();
  items.push({
    text: itemText,
    class: cls,
    source: String(evidence.source || 'operator_entered').trim() || 'operator_entered',
    flags: newFlagKeys,
    at: ts,
  });

  // Research is an ADDITIVE evidence log. The score reflects the union of all
  // flagged factors confirmed across every research entry — not just the latest
  // invocation. Rebuild the scoring flags from the full log.
  const allFlags = {};
  for (const item of items) {
    for (const k of item.flags || []) allFlags[k] = true;
  }

  // Reconstruct the representative evidence object for the existing scorer.
  // The canonical `evidence_class` takes the classification of the most recent
  // non-UNKNOWN item (mirrors "most specific available evidence"), without ever
  // upgrading an item's own classification. Score itself is purely flag-driven.
  const representative = items
    .slice()
    .reverse()
    .find((i) => i.class !== 'UNKNOWN');
  const repClass = representative ? representative.class : 'UNKNOWN';
  const combinedText = items
    .map((i) => i.text)
    .filter((t) => t)
    .join(' | ');

  // Re-run the validated scorer (assessOpportunity). It updates
  // opportunity_score / opportunity_score_reason / recovery_signal_strength /
  // evidence_class / recovery_signal_evidence. The score reflects the union of
  // all flagged factors confirmed across every research entry, not just the
  // latest invocation. It does NOT touch research_status, so research ≠
  // approval (nothing is auto-approved or made outreach-ready).
  let scored;
  try {
    scored = assessOpportunity(rec, allFlags, { cls: repClass, text: combinedText });
  } catch (e) {
    return { ok: false, error: 'scoring_failed', detail: String((e && e.message) || e), value: rec };
  }
  if (!scored.ok) return { ok: false, error: 'scoring_failed', value: rec };

  rec.research_evidence = JSON.stringify(items);

  if (o.note != null && String(o.note).trim() !== '') {
    rec.research_notes = (rec.research_notes ? rec.research_notes + ' | ' : '') + `OPERATOR:${String(o.note).trim()}`;
  }

  // Audit stamp (wrapper-level; the validated scorer/mutators still own logic).
  rec.updated_at = ts;

  let saved;
  try {
    saved = updateProspect(file, rec);
  } catch (e) {
    // Atomic write failed; the store is untouched; never report success.
    return { ok: false, error: 'persist_failed', detail: String((e && e.message) || e), value: rec };
  }
  if (!saved) return { ok: false, error: 'persist_failed', value: rec };
  return { ok: true, value: saved };
}

// Outreach brief for an updated prospect: the validated builder output is left
// byte-for-byte intact (protected), read-side enriched with the updated score,
// score explanation, and the distinct-classified evidence items so the operator
// can see observed vs inferred side by side. No unsupported claims.
function researchBrief(file, id) {
  const rec = getProspect(file, id);
  if (!rec) return { ok: false, error: 'not_found' };
  const b = buildOutreachBrief(rec);
  if (!b.ok) return { ok: false, error: b.error };
  return {
    ok: true,
    value: {
      ...b.brief,
      opportunity_score: rec.opportunity_score,
      opportunity_score_reason: rec.opportunity_score_reason,
      evidence_items: parseResearchEvidence(rec),
    },
  };
}

// The valid contact-policy vocabulary. Per Pass 7, UNKNOWN (!= 'permitted')
// blocks outreach eligibility; only explicit 'permitted' allows onward.
const CONTACT_POLICIES = ['permitted', 'blocked', 'unknown'];

// Normalize an operator-supplied contact policy. Accepted:
//   '' | 'unknown' | 'blocked' | 'permitted'
// Anything else is invalid (never silently coerced).
function normalizeContactPolicy(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  if (v === '') return 'unknown';
  return CONTACT_POLICIES.includes(v) ? v : null;
}

// Is this prospect durably opted out? Opt-out is a terminal blocking condition:
// true regardless of string casing, and it can never be cleared by `policy`.
function isOptedOut(rec) {
  return rec.opt_out === true || rec.opt_out === 'TRUE' || rec.opt_out === 'true';
}

// Operator sets (or clears toward) the explicit contact policy on the canonical
// prospect. Pass 7 operator wiring:
//
//   LOAD canonical prospect (fresh from disk)
//   → VALIDATE policy vocabulary (permitted|blocked|unknown)
//   → GUARD opt-out: a permitted policy can NEVER revive an opted-out prospect
//   → MUTATE record.contact_policy
//   → STAMP updated_at
//   → ATOMIC PERSIST single record (updateProspect)
//   → CONFIRM — or explicit failure (invalid_policy / opted_out / not_found /
//                persist_failed)
//
// It NEVER reverses suppression or opt-out, NEVER sends outreach, and NEVER
// touches the outreach queue directly. Queueing is still gated by
// queueProspect()/prepareDraft()/sendOutreach() against contact_policy ===
// 'permitted'.
//
// opts: { now }
function policyAndPersist(file, id, policy, now) {
  if (!id) return { ok: false, error: 'missing_id' };
  const rec = getProspect(file, id);
  if (!rec) return { ok: false, error: 'not_found' };

  const ts = now || new Date().toISOString();
  const norm = normalizeContactPolicy(policy);
  if (norm === null) {
    return { ok: false, error: `invalid_policy:${String(policy)}`, value: rec };
  }

  // Opt-out is durable: a permitted policy can never override it.
  if (isOptedOut(rec) && norm === 'permitted') {
    return { ok: false, error: 'opted_out', reason: 'opted-out prospects cannot be granted permitted policy', value: rec };
  }

  rec.contact_policy = norm;
  rec.updated_at = ts;

  let saved;
  try {
    saved = updateProspect(file, rec);
  } catch (e) {
    return { ok: false, error: 'persist_failed', detail: String((e && e.message) || e), value: rec };
  }
  if (!saved) return { ok: false, error: 'persist_failed', value: rec };
  return { ok: true, value: saved };
}

// Operator records an explicit opt-out on the canonical prospect. Pass 7
// operator wiring:
//
//   LOAD canonical prospect (fresh from disk)
//   → SET opt_out = true (and reason + timestamp)
//   → ACTIVATE suppression (suppress from lib/suppress) so entire review/queue
//     path honors it immediately
//   → STAMP updated_at
//   → ATOMIC PERSIST single record (updateProspect)
//   → CONFIRM — or explicit failure (persist_failed)
//
// Opt-out is the strongest blocking condition: it sets opt_out AND suppression,
// is durable across persistence, and can never be reversed by `policy
// permitted` (enforced in policyAndPersist). It sends no outreach.
//
// opts: { now }
function optoutAndPersist(file, id, reason, now) {
  if (!id) return { ok: false, error: 'missing_id' };
  const rec = getProspect(file, id);
  if (!rec) return { ok: false, error: 'not_found' };

  const ts = now || new Date().toISOString();
  rec.opt_out = true;
  rec.opt_out_reason = String(reason == null ? '' : reason).trim() || 'other';
  rec.opt_out_at = ts;

  // Activate suppression (and terminal review state). This makes the opt-out
  // honored by the entire validated review + outreach-eligibility path.
  suppress(rec, `opted_out:${rec.opt_out_reason}`, ts);

  let saved;
  try {
    saved = updateProspect(file, rec);
  } catch (e) {
    return { ok: false, error: 'persist_failed', detail: String((e && e.message) || e), value: rec };
  }
  if (!saved) return { ok: false, error: 'persist_failed', value: rec };
  return { ok: true, value: saved };
}

module.exports = {
  loadProspect,
  reviewAndPersist,
  researchAndPersist,
  policyAndPersist,
  optoutAndPersist,
  reviewBrief,
  researchBrief,
  listProspects,
  parseResearchEvidence,
  normalizeContactPolicy,
  isOptedOut,
  CONTACT_POLICIES,
};
