import type { Repositories } from "../../db/repositories/index.ts";
import type { WalletLedgerEntry } from "../types.ts";
import { walletLedgerToPaymentEvent } from "./adapters/wallet.ts";
import { ingestPaymentEvent } from "./ingest.ts";
import type { IngestOutcome, PaymentEvent } from "./types.ts";

/**
 * Outcome of routing one wallet ledger entry through the Payment Source
 * Layer. `skipped` records ledger types that deliberately carry no payment
 * semantics (only `OPENING_BALANCE` today) without fabricating an event.
 */
export type WalletLedgerIngestOutcome =
  | { readonly skipped: true; readonly entry: WalletLedgerEntry }
  | {
      readonly skipped: false;
      readonly entry: WalletLedgerEntry;
      readonly recorded: boolean;
      readonly replay: boolean;
      readonly event: PaymentEvent;
    };

/**
 * Canonical bridge from the wallet ledger into the Payment Source Layer.
 *
 * Async-ingests every eligible ledger entry through the existing
 * deterministic idempotency gate (`ingestPaymentEvent`), so the same entry
 * always resolves to the same stored `PaymentEvent` no matter how many times
 * it is replayed — including after a process restart that reads the same
 * committed database. Ledger entries are never modified, and nothing here calls
 * the reconciliation engine directly: that stays the storefront layer's job.
 */
export async function ingestWalletLedgerEntries(
  repos: Repositories,
  entries: readonly WalletLedgerEntry[],
  options: { readonly now?: number } = {},
): Promise<readonly WalletLedgerIngestOutcome[]> {
  const outcomes: WalletLedgerIngestOutcome[] = [];
  for (const entry of entries) {
    const draft = walletLedgerToPaymentEvent(entry);
    if (draft === null) {
      outcomes.push({ skipped: true, entry });
      continue;
    }
    const outcome: IngestOutcome = await ingestPaymentEvent(
      repos,
      draft,
      options,
    );
    outcomes.push({ skipped: false, entry, ...outcome });
  }
  return outcomes;
}

/**
 * Convenience projection for callers that only care about the events that
 * were actually recorded (or replayed) for a batch of ledger entries.
 */
export function recordedWalletEvents(
  outcomes: readonly WalletLedgerIngestOutcome[],
): readonly PaymentEvent[] {
  return outcomes
    .filter(
      (
        outcome,
      ): outcome is Extract<WalletLedgerIngestOutcome, { skipped: false }> =>
        !outcome.skipped,
    )
    .map((outcome) => outcome.event);
}
