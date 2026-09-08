import type {
  ReconciliationCode,
  SourceAttributes,
} from "../../../src/domain/model.ts";
import type {
  EvidencePack,
  MarketplaceService,
  ReconciliationSnapshot,
  ResolutionStatus,
} from "./types.ts";

/**
 * Phase 2G evidence surface.
 *
 * The reconciliation truth and the evidence pack itself are produced by
 * Phase 2F (`reconcile.ts` stores one `EvidencePack` per transaction in the
 * `evidence_packs` kind). This module never re-runs the engine and never
 * invents provider facts; it is the redaction layer that turns raw provider
 * source attributes into a safe, customer-presentable evidence pack.
 *
 * Rules:
 * - Sensitive material (gift card codes, pins, tokens, card numbers) is
 *   removed from `providerFacts` and replaced by a masked preview (first four
 *   characters surrendered to `****`, last four retained).
 * - `masked_code_preview` in a raw attribute set is passed through untouched;
 *   the full code material is never admitted to the pack.
 * - The result is a plain `EvidencePack` (same model as Phase 2F, same
 *   deterministic id) so Reconcile Kit semantics stay single-sourced.
 */

const SENSITIVE_KEY_PATTERN =
  /(code|pin|serial|token|secret|cvv|pan|password|number)/i;

const MASKED_PREVIEW_KEY = "maskedCodePreview";
const MASKED_FIELDS_KEY = "masked_fields";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function maskedPreview(value: string): string {
  return `****${value.slice(-4)}`;
}

/**
 * Pure redaction over provider source attributes. Sinensitive values are
 * dropped entirely; a `maskedCodePreview` (first code material found) and a
 * `masked_fields` audit trail are attached. Non-sensitive attributes pass
 * through unchanged.
 */
export function maskProviderFacts(
  providerFacts: SourceAttributes,
): SourceAttributes {
  const masked: Record<string, string> = {};
  const maskedFields: string[] = [];
  let previewWritten = false;
  for (const [key, value] of Object.entries(providerFacts)) {
    if (isSensitiveKey(key)) {
      maskedFields.push(key);
      if (!previewWritten) {
        masked[MASKED_PREVIEW_KEY] = maskedPreview(value);
        previewWritten = true;
      }
      continue;
    }
    masked[key] = value;
  }
  if (maskedFields.length > 0) {
    masked[MASKED_FIELDS_KEY] = maskedFields.join(",");
  }
  return masked;
}

export interface BuildEvidencePackInput {
  readonly transactionId: string;
  readonly customerReference: string;
  readonly providerReference: string | null;
  readonly paymentReference: string | null;
  readonly serviceSnapshot: MarketplaceService;
  readonly amountMinor: number;
  readonly currency: string;
  readonly timelineEventIds: readonly string[];
  readonly providerFacts: SourceAttributes;
  readonly reconciliation: ReconciliationSnapshot | null;
  readonly mismatchFlags: readonly ReconciliationCode[];
  readonly resolutionStatus: ResolutionStatus;
  readonly auditEventIds: readonly string[];
  readonly now: string;
}

/**
 * Deterministic evidence-pack builder. Reconcile Kit's verdict is carried in
 * `reconciliation` as-supplied (never recomputed) and `providerFacts` is
 * always masked before it is admitted to the pack.
 */
export function buildEvidencePack(input: BuildEvidencePackInput): EvidencePack {
  return {
    id: `evp_${input.transactionId}`,
    transactionId: input.transactionId,
    customerReference: input.customerReference,
    providerReference: input.providerReference,
    paymentReference: input.paymentReference,
    serviceSnapshot: input.serviceSnapshot,
    amountMinor: input.amountMinor,
    currency: input.currency,
    timelineEventIds: [...input.timelineEventIds],
    providerFacts: maskProviderFacts(input.providerFacts),
    reconciliation: input.reconciliation,
    mismatchFlags: Array.from(new Set(input.mismatchFlags)),
    resolutionStatus: input.resolutionStatus,
    auditEventIds: [...input.auditEventIds],
    createdAt: input.now,
    simulated: true,
  };
}

/**
 * Immutable display transform over a stored Phase 2F pack: same id, same
 * reconciliation snapshot, surgical redaction of `providerFacts`. The stored
 * pack on disk is never mutated.
 */
export function redactEvidencePack(pack: EvidencePack): EvidencePack {
  return {
    ...pack,
    providerFacts: maskProviderFacts(pack.providerFacts),
  };
}
