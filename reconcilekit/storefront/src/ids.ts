import { randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function buildPaymentReference(orderId: string): string {
  return `stf_${orderId.replace(/-/g, "")}`;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash;
}

export function stableToken(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (cleaned === "") return "ref";
  const digest = fnv1a(cleaned).toString(16).padStart(8, "0");
  return `${cleaned.slice(0, 24)}_${digest}`;
}

/**
 * Deterministic marketplace identity seed. The same (customer, service,
 * scenario, inputs) always yields the same seed, which makes transaction
 * execution idempotent by identity: a repeated call replays the persisted
 * trail instead of moving money twice.
 */
export function buildMarketplaceSeed(input: {
  readonly customerId: string;
  readonly serviceId: string;
  readonly scenario: string;
  readonly inputsKey: string;
}): string {
  return `${input.customerId}|${input.serviceId}|${input.scenario}|${input.inputsKey}`;
}

export function buildTransactionId(seed: string): string {
  return `mk_txn_${stableToken(seed)}`;
}

export function buildTransactionReference(seed: string): string {
  return `txn_${stableToken(seed)}`;
}

export function buildOrderId(seed: string): string {
  return `ord_${stableToken(seed)}`;
}

export function buildProviderAttemptId(
  transactionId: string,
  attemptNumber: number,
): string {
  return `patt_${stableToken(transactionId)}_${attemptNumber}`;
}

export function buildRequestId(
  transactionId: string,
  attemptNumber: number,
): string {
  return `req_${stableToken(transactionId)}_${attemptNumber}`;
}

export function buildCorrelationId(transactionId: string): string {
  return `corr_${stableToken(transactionId)}`;
}

export function buildCustomerReference(customerId: string): string {
  return `cust_${stableToken(customerId)}`;
}

export function buildEventId(transactionId: string, seq: number): string {
  return `evt_${stableToken(transactionId)}_${String(seq).padStart(4, "0")}`;
}

/** Stable, order-independent hash of a flat inputs object. */
export function buildInputsKey(
  inputs: Readonly<Record<string, string>>,
): string {
  return Object.keys(inputs)
    .slice()
    .sort()
    .map((key) => `${key}:${inputs[key]}`)
    .join("|");
}

/**
 * Deterministic, slug-like suffix for id templates (e.g. `gift_<suffix>`).
 * The same value always yields the same suffix, which keeps marketplace ids
 * reproducible without leaking the raw value.
 */
export function buildStableSuffix(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned === "" ? "ref" : cleaned.slice(0, 24);
}
