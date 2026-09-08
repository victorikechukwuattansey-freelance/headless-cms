import { hasConflictingAttributes } from "./duplicates.ts";
import type {
  MatchCandidate,
  MatchResult,
  MerchantPayment,
  Outcome,
  ProviderPayment,
  ReconciliationCode,
  ReconciliationConfig,
  ReconciliationReport,
  ReconciliationSummary,
  SourceAttributes,
  ValidationResult,
} from "./model.ts";
import {
  buildMerchantIndex,
  buildProviderIndex,
  normalizeReference,
} from "./reference.ts";
import {
  validateAmount,
  validateCurrency,
  validatePaymentInput,
  validateStatus,
  validateTimestamp,
} from "./validation.ts";

const ALL_CODES: readonly ReconciliationCode[] = [
  "AMOUNT_MISMATCH",
  "CURRENCY_MISMATCH",
  "STATUS_MISMATCH",
  "TEMPORAL_ANOMALY",
  "DUPLICATE_MERCHANT_RECORD",
  "DUPLICATE_PROVIDER_RECORD",
  "CONFLICTING_ATTRIBUTES",
  "STATUS_UNRESOLVED",
];

export interface ReconcileOptions {
  readonly providerSourceAttributes?: readonly SourceAttributes[];
}

export function reconcile(
  merchantPayments: readonly MerchantPayment[],
  providerPayments: readonly ProviderPayment[],
  config: ReconciliationConfig,
  options: ReconcileOptions = {},
): ReconciliationReport {
  assertValidConfig(config);
  const merchantIndex = buildMerchantIndex(
    merchantPayments.filter(
      (payment) => validatePaymentInput(payment, config).valid,
    ),
  );
  const providerIndex = buildProviderIndex(
    providerPayments.filter(
      (payment) => validatePaymentInput(payment, config).valid,
    ),
  );
  const providedAttributes = options.providerSourceAttributes ?? [];
  const attributesByProvider = new Map<ProviderPayment, SourceAttributes>();
  providerPayments.forEach((payment, index) => {
    attributesByProvider.set(payment, providedAttributes[index] ?? {});
  });
  const results: MatchResult[] = [];
  for (const merchant of merchantPayments) {
    results.push(
      reconcileMerchant(
        merchant,
        merchantIndex,
        providerIndex,
        config,
        attributesByProvider,
      ),
    );
  }
  for (const provider of providerPayments) {
    const result = reconcileProvider(
      provider,
      merchantIndex,
      providerIndex,
      config,
      attributesByProvider,
    );
    if (result !== null) {
      results.push(result);
    }
  }
  return {
    summary: buildSummary(
      merchantPayments.length,
      providerPayments.length,
      results,
    ),
    results,
  };
}

function assertValidConfig(config: ReconciliationConfig): void {
  const timestampValidation = config.timestampValidation;
  if (
    timestampValidation.enabled &&
    (!Number.isFinite(timestampValidation.toleranceMs) ||
      timestampValidation.toleranceMs < 0)
  ) {
    throw new Error(
      "timestamp tolerance must be a non-negative finite number of milliseconds when timestamp validation is enabled",
    );
  }
}

function reconcileMerchant(
  merchant: MerchantPayment,
  merchantIndex: ReadonlyMap<string, readonly MerchantPayment[]>,
  providerIndex: ReadonlyMap<string, readonly ProviderPayment[]>,
  config: ReconciliationConfig,
  attributesByProvider: ReadonlyMap<ProviderPayment, SourceAttributes>,
): MatchResult {
  const inputValidation = validatePaymentInput(merchant, config);
  if (!inputValidation.valid) {
    return outcome(
      "INPUT_ERROR",
      merchant,
      null,
      [],
      [inputValidation.note],
      {},
    );
  }
  const reference = normalizeReference(merchant.merchant_reference);
  if (reference === null) {
    return outcome(
      "MISSING_REFERENCE",
      merchant,
      null,
      [],
      [
        "unusable reference: absent, empty, or whitespace-only after normalization",
      ],
      {},
    );
  }
  const merchantSet = merchantIndex.get(reference);
  if (merchantSet !== undefined && merchantSet.length > 1) {
    return duplicateOutcome(
      merchant,
      merchantSet,
      "DUPLICATE_MERCHANT_RECORD",
      {},
    );
  }
  const providerSet = providerIndex.get(reference);
  if (providerSet === undefined) {
    return outcome(
      "MISSING_PROVIDER_RECORD",
      merchant,
      null,
      [],
      ["no provider candidate for reference"],
      {},
    );
  }
  if (providerSet.length > 1) {
    return outcome(
      "HELD_AMBIGUOUS",
      merchant,
      null,
      [],
      ["multiple provider candidates for reference; no arbitrary pairing"],
      {},
    );
  }
  const provider = providerSet[0];
  const candidate: MatchCandidate = {
    merchant_payment: merchant,
    provider_payment: provider,
  };
  return classify(
    candidate,
    runValidations(candidate, config),
    attributesByProvider.get(provider) ?? {},
  );
}

function reconcileProvider(
  provider: ProviderPayment,
  merchantIndex: ReadonlyMap<string, readonly MerchantPayment[]>,
  providerIndex: ReadonlyMap<string, readonly ProviderPayment[]>,
  config: ReconciliationConfig,
  attributesByProvider: ReadonlyMap<ProviderPayment, SourceAttributes>,
): MatchResult | null {
  const sourceAttributes = attributesByProvider.get(provider) ?? {};
  const inputValidation = validatePaymentInput(provider, config);
  if (!inputValidation.valid) {
    return outcome(
      "INPUT_ERROR",
      null,
      provider,
      [],
      [inputValidation.note],
      sourceAttributes,
    );
  }
  const reference = normalizeReference(provider.reference);
  if (reference === null) {
    return outcome(
      "MISSING_REFERENCE",
      null,
      provider,
      [],
      [
        "unusable reference: absent, empty, or whitespace-only after normalization",
      ],
      sourceAttributes,
    );
  }
  const providerSet = providerIndex.get(reference);
  if (providerSet !== undefined && providerSet.length > 1) {
    return duplicateOutcome(
      provider,
      providerSet,
      "DUPLICATE_PROVIDER_RECORD",
      sourceAttributes,
    );
  }
  const merchantSet = merchantIndex.get(reference);
  if (merchantSet === undefined) {
    return outcome(
      "UNMATCHED_PROVIDER_RECORD",
      null,
      provider,
      [],
      ["no merchant candidate for reference"],
      sourceAttributes,
    );
  }
  if (merchantSet.length > 1) {
    return outcome(
      "HELD_AMBIGUOUS",
      null,
      provider,
      [],
      ["merchant candidates duplicated; no arbitrary pairing"],
      sourceAttributes,
    );
  }
  return null;
}

function duplicateOutcome(
  record: MerchantPayment | ProviderPayment,
  duplicateSet: readonly (MerchantPayment | ProviderPayment)[],
  duplicateCode: Extract<
    ReconciliationCode,
    "DUPLICATE_MERCHANT_RECORD" | "DUPLICATE_PROVIDER_RECORD"
  >,
  sourceAttributes: SourceAttributes,
): MatchResult {
  const codes: ReconciliationCode[] = [duplicateCode];
  const notes: string[] = ["reference duplicates expected-unique identity"];
  if (hasConflictingAttributes(duplicateSet)) {
    codes.push("CONFLICTING_ATTRIBUTES");
    notes.push("duplicate candidates carry materially conflicting attributes");
  }
  if ("merchant_reference" in record) {
    return outcome(
      "HELD_AMBIGUOUS",
      record as MerchantPayment,
      null,
      codes,
      notes,
      sourceAttributes,
    );
  }
  return outcome(
    "HELD_AMBIGUOUS",
    null,
    record as ProviderPayment,
    codes,
    notes,
    sourceAttributes,
  );
}

function runValidations(
  candidate: MatchCandidate,
  config: ReconciliationConfig,
): readonly ValidationResult[] {
  const { merchant_payment: merchant, provider_payment: provider } = candidate;
  return [
    validateAmount(merchant, provider),
    validateCurrency(merchant, provider),
    validateStatus(merchant, provider),
    validateTimestamp(merchant, provider, config),
  ];
}

function classify(
  candidate: MatchCandidate,
  validations: readonly ValidationResult[],
  sourceAttributes: SourceAttributes,
): MatchResult {
  const failed = validations.filter(
    (
      validation,
    ): validation is ValidationResult & { code: ReconciliationCode } =>
      validation.applicable && !validation.passed && validation.code !== null,
  );
  const discrepancyCodes = failed.filter(
    (validation) => validation.code !== "STATUS_UNRESOLVED",
  );
  const codes: ReconciliationCode[] = failed.map(
    (validation) => validation.code,
  );
  const notes: string[] = validations
    .filter(
      (validation): validation is ValidationResult & { note: string } =>
        validation.note !== null,
    )
    .map((validation) => validation.note);
  let finalOutcome: Outcome;
  if (discrepancyCodes.length > 0) {
    finalOutcome = "DISCREPANCY";
  } else if (codes.length > 0) {
    finalOutcome = "UNRESOLVED";
  } else {
    finalOutcome = "MATCH";
  }
  return {
    outcome: finalOutcome,
    merchant_record: candidate.merchant_payment,
    provider_record: candidate.provider_payment,
    discrepancy_codes: codes,
    validation_notes: notes,
    source_attributes: sourceAttributes,
  };
}

function outcome(
  finalOutcome: Outcome,
  merchant: MerchantPayment | null,
  provider: ProviderPayment | null,
  codes: readonly ReconciliationCode[],
  notes: readonly string[],
  sourceAttributes: SourceAttributes,
): MatchResult {
  return {
    outcome: finalOutcome,
    merchant_record: merchant,
    provider_record: provider,
    discrepancy_codes: codes,
    validation_notes: notes,
    source_attributes: sourceAttributes,
  };
}

function buildSummary(
  merchantCount: number,
  providerCount: number,
  results: readonly MatchResult[],
): ReconciliationSummary {
  const outcomeCounts: Record<Outcome, number> = {
    MATCH: 0,
    DISCREPANCY: 0,
    UNRESOLVED: 0,
    HELD_AMBIGUOUS: 0,
    INPUT_ERROR: 0,
    MISSING_PROVIDER_RECORD: 0,
    UNMATCHED_PROVIDER_RECORD: 0,
    MISSING_REFERENCE: 0,
  };
  const codeCounts: Record<ReconciliationCode, number> = Object.fromEntries(
    ALL_CODES.map((code) => [code, 0]),
  ) as Record<ReconciliationCode, number>;
  for (const result of results) {
    outcomeCounts[result.outcome] += 1;
    for (const code of result.discrepancy_codes) {
      codeCounts[code] += 1;
    }
  }
  return {
    totalRecords: merchantCount + providerCount,
    matched: outcomeCounts.MATCH,
    discrepancies: outcomeCounts.DISCREPANCY,
    unresolved: outcomeCounts.UNRESOLVED,
    heldAmbiguous: outcomeCounts.HELD_AMBIGUOUS,
    inputErrors: outcomeCounts.INPUT_ERROR,
    missingProviderRecords: outcomeCounts.MISSING_PROVIDER_RECORD,
    unmatchedProviderRecords: outcomeCounts.UNMATCHED_PROVIDER_RECORD,
    missingReference: outcomeCounts.MISSING_REFERENCE,
    countsByDiscrepancyCode: codeCounts,
  };
}
