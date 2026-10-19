import type { Repositories } from "../db/repositories/index.ts";
import { buildTransactionId, buildTransactionReference } from "../ids.ts";
import { buildDemoCatalog } from "./catalog.ts";
import { DEMO_MEMBERSHIP_ID, DEMO_ORG_ID, DEMO_ORG_NAME } from "./tenancy.ts";
import type {
  MarketplaceCustomer,
  MembershipRecord,
  OrganizationRecord,
} from "./types.ts";
import { DEMO_USER_ID, seedDemoUser } from "../auth/identity.ts";
import { createMockProviderRegistry } from "./providers/registry.ts";
import type { PaymentProvider } from "./providers/contracts.ts";
import {
  createWallet,
  fundWallet,
  getWalletBalance,
  readWalletById,
  WALLET_FIXED_TIMESTAMP,
  type FundWalletOutcome,
} from "./wallet.ts";
import {
  executeMarketplaceTransaction,
  type MarketplaceTransactionDeps,
} from "./transactions.ts";
import {
  reconcileMarketplaceTransaction,
  type MarketplaceReconcileDeps,
} from "./reconcile.ts";
import type {
  EvidencePack,
  MarketplaceTransaction,
  WalletLedgerEntry,
} from "./types.ts";
import type { TransactionTruth } from "./truth.ts";
import {
  DEMO_ORDER_SCENARIOS,
  demoMarketplaceSeed,
  WALLET_FUNDING_SCENARIO_NAME,
  type DemoScenarioName,
  type DemoOrderScenario,
} from "./demo-scenarios.ts";

/**
 * Fixed timestamp for every seeded artifact so ids, ledger references, and
 * timestamps are reproducible. Mirrors the WALLET_FIXED_TIMESTAMP convention
 * used across the marketplace tests.
 */
export const DEMO_SEED_TIMESTAMP = WALLET_FIXED_TIMESTAMP;
export const DEMO_CUSTOMER_RECORD_ID = "cus_demo";

export const DEMO_WALLET_FUNDING_CUSTOMER_ID = "cus_demo_wallet_funding";
export const DEMO_WALLET_FUNDING_WALLET_ID = "wl_demo_wallet_funding";
export const DEMO_WALLET_FUNDING_TRANSACTION_ID = "fund_wallet_funding_demo";
const DEMO_WALLET_FUNDING_AMOUNT_MINOR = 25_000;
const DEMO_WALLET_FUNDING_OPENING_MINOR = 100_000;
const DEMO_WALLET_FUNDING_CURRENCY = "NGN";

export interface SeededOrderEntry {
  readonly demoScenarioName: DemoScenarioName;
  readonly kind: "ORDER";
  readonly transactionId: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly transaction: MarketplaceTransaction;
  readonly truth: TransactionTruth;
  readonly pack: EvidencePack;
}

export interface SeededWalletFundingEntry {
  readonly demoScenarioName: typeof WALLET_FUNDING_SCENARIO_NAME;
  readonly kind: "WALLET_FUNDING";
  readonly transactionId: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly walletId: string;
  /** Present on a fresh run; null when this seed store already has the entry. */
  readonly outcome: FundWalletOutcome | null;
}

export type SeededDemoEntry = SeededOrderEntry | SeededWalletFundingEntry;

/**
 * Phase 5A.2 — seed the demo tenant.
 *
 * Phase 5B.1c-1b: organizations and memberships move to Postgres. Customers
 * stay in JSONL for this increment (they migrate with `marketplace_customers`
 * later).
 *
 * Creates one org, one membership tying the demo user to that org, and the
 * two known demo customer records (the main demo customer and the wallet
 * funding customer) with `org_id` set.
 *
 * Idempotent: repeated calls converge on the same records.
 */
export async function seedDemoTenancy(repos: Repositories): Promise<void> {
  const org = await repos.organizations.readLatestById(DEMO_ORG_ID);
  if (org === null) {
    await repos.organizations.insert({
      id: DEMO_ORG_ID,
      name: DEMO_ORG_NAME,
      created_at: DEMO_SEED_TIMESTAMP,
      simulated: true,
    });
  }

  const membership = await repos.memberships.findByUserAndOrg(
    DEMO_USER_ID,
    DEMO_ORG_ID,
  );
  if (membership === null) {
    await repos.memberships.insert({
      id: DEMO_MEMBERSHIP_ID,
      user_id: DEMO_USER_ID,
      org_id: DEMO_ORG_ID,
      role: "OWNER",
      created_at: DEMO_SEED_TIMESTAMP,
      simulated: true,
    });
  }

  // Each demo scenario uses its own per-scenario customer (e.g.
  // `cus_demo_airtime`, `cus_demo_data`) so its wallet stays independent of
  // the others. Every one of those customers must exist in Postgres before
  // executeMarketplaceTransaction creates a wallet for it — otherwise
  // wallets.customer_id → marketplace_customers.id fails.
  const customerNames = new Map<string, string>();
  customerNames.set(DEMO_CUSTOMER_RECORD_ID, "Demo Customer");
  customerNames.set(
    DEMO_WALLET_FUNDING_CUSTOMER_ID,
    "Demo Wallet Funding Customer",
  );
  for (const scenario of DEMO_ORDER_SCENARIOS) {
    if (!customerNames.has(scenario.customerId)) {
      customerNames.set(
        scenario.customerId,
        `Demo Customer ${scenario.customerId}`,
      );
    }
  }

  for (const [customerId, name] of customerNames) {
    await ensureDemoCustomer(repos, customerId, name);
  }
}

async function ensureDemoCustomer(
  repos: Repositories,
  customerId: string,
  name: string,
): Promise<void> {
  const existing = await repos.marketplaceCustomers.readLatestById(customerId);
  if (existing !== null && existing.org_id === DEMO_ORG_ID) {
    return;
  }
  await repos.marketplaceCustomers.insert({
    id: customerId,
    org_id: DEMO_ORG_ID,
    name,
    email: "demo@example.com",
    phone: "+2340000000000",
    isDemo: true,
    createdAt: DEMO_SEED_TIMESTAMP,
  });
}

export interface SeededDemoData {
  /** All 16 canonical demo scenarios, one entry each. */
  readonly transactions: readonly SeededDemoEntry[];
  /** Lookup by canonical scenario name; keyed by the `demoScenarioName`. */
  readonly byName: Readonly<Record<string, SeededDemoEntry>>;
  /** `txn_<slug>` -> canonical transaction id for the 15 orderable scenarios. */
  readonly aliases: Readonly<Record<string, string>>;
  /** `txn_<slug>` -> canonical transaction reference for the 15 orderable scenarios. */
  readonly referenceAliases: Readonly<Record<string, string>>;
}

function buildAliasMaps(): {
  readonly aliases: Readonly<Record<string, string>>;
  readonly referenceAliases: Readonly<Record<string, string>>;
} {
  const aliases: Record<string, string> = {};
  const referenceAliases: Record<string, string> = {};
  for (const scenario of DEMO_ORDER_SCENARIOS) {
    const seed = demoMarketplaceSeed(scenario);
    aliases[`txn_${scenario.name}`] = buildTransactionId(seed);
    referenceAliases[`txn_${scenario.name}`] = buildTransactionReference(seed);
  }
  return { aliases, referenceAliases };
}

/**
 * Execute + reconcile one demo order scenario and persist a friendly
 * `demoScenarioName` (the slug) on the final transaction record. Repeated
 * calls converge: execution and reconciliation replay by identity, and the
 * friendly-name override is skipped once the latest record already carries it.
 */
async function seedOrderScenario(
  deps: MarketplaceTransactionDeps,
  reconcileDeps: MarketplaceReconcileDeps,
  scenario: DemoOrderScenario,
): Promise<SeededOrderEntry> {
  const executed = await executeMarketplaceTransaction(deps, {
    customerId: scenario.customerId,
    serviceId: scenario.serviceId,
    scenario: scenario.scenario,
    inputs: scenario.inputs,
    now: DEMO_SEED_TIMESTAMP,
  });
  const transactionId = executed.transaction.id;
  const reconciled = await reconcileMarketplaceTransaction(reconcileDeps, {
    transactionId,
    now: DEMO_SEED_TIMESTAMP,
  });

  const latest =
    (await deps.repos.marketplaceTransactions.readLatestById(transactionId)) ??
    executed.transaction;

  let transaction: MarketplaceTransaction = latest;
  if (latest.demoScenarioName !== scenario.name) {
    transaction = { ...latest, demoScenarioName: scenario.name };
    await deps.repos.marketplaceTransactions.insert(transaction);
  }

  return {
    demoScenarioName: scenario.name,
    kind: "ORDER",
    transactionId,
    reference: transaction.reference,
    createdAt: transaction.updatedAt,
    transaction,
    truth: reconciled.truth,
    pack: reconciled.pack,
  };
}

/**
 * Seed the wallet-funding-failure scenario through the application-layer
 * `fundWallet` path: a failed funding attempt leaves the opening balance
 * intact and records FUNDING_INITIATED + failure ledger entries. Idempotent —
 * once a ledger entry for the deterministic funding transaction exists, the
 * funding is not attempted again.
 */
export async function seedWalletFundingFailure(
  repos: Repositories,
  provider: PaymentProvider,
  now: string = DEMO_SEED_TIMESTAMP,
): Promise<SeededWalletFundingEntry> {
  const wallet = await readWalletById(repos, DEMO_WALLET_FUNDING_WALLET_ID);
  if (wallet === null) {
    await createWallet(repos, {
      id: DEMO_WALLET_FUNDING_WALLET_ID,
      customerId: DEMO_WALLET_FUNDING_CUSTOMER_ID,
      currency: DEMO_WALLET_FUNDING_CURRENCY,
      openingBalanceMinor: DEMO_WALLET_FUNDING_OPENING_MINOR,
      now,
    });
  }

  const ledger = await repos.walletLedger.listByWallet(
    DEMO_WALLET_FUNDING_WALLET_ID,
  );
  const prior = ledger.find(
    (entry) => entry.transactionId === DEMO_WALLET_FUNDING_TRANSACTION_ID,
  );

  let outcome: FundWalletOutcome | null = null;
  if (prior === undefined) {
    outcome = await fundWallet(repos, provider, {
      walletId: DEMO_WALLET_FUNDING_WALLET_ID,
      customerId: DEMO_WALLET_FUNDING_CUSTOMER_ID,
      amountMinor: DEMO_WALLET_FUNDING_AMOUNT_MINOR,
      currency: DEMO_WALLET_FUNDING_CURRENCY,
      scenario: "FAILED",
      now,
      relatedTransactionId: DEMO_WALLET_FUNDING_TRANSACTION_ID,
    });
  }

  return {
    demoScenarioName: WALLET_FUNDING_SCENARIO_NAME,
    kind: "WALLET_FUNDING",
    transactionId: DEMO_WALLET_FUNDING_TRANSACTION_ID,
    reference:
      prior?.reference ??
      `wlf_${WALLET_FUNDING_SCENARIO_NAME.replace(/_/g, "")}`,
    createdAt: now,
    walletId: DEMO_WALLET_FUNDING_WALLET_ID,
    outcome,
  };
}

/**
 * Deterministic demo seed for all 16 canonical scenarios. Uses the same
 * application-layer functions as the UI (execute + reconcile for the 15
 * orderable scenarios, fundWallet for wallet funding failure), so a seeded
 * store is indistinguishable in shape from one produced by real use.
 */
export async function seedDemoData(
  repos: Repositories,
): Promise<SeededDemoData> {
  // Postgres FK ordering: memberships.user_id -> users.id, so the demo user
  // must exist before seedDemoTenancy inserts the membership. Under JSONL
  // this ordering did not matter; under Postgres it does.
  await seedDemoUser(repos);
  await seedDemoTenancy(repos);

  const catalog = buildDemoCatalog();
  const registry = createMockProviderRegistry();
  const deps: MarketplaceTransactionDeps = { repos, registry, catalog };
  const reconcileDeps: MarketplaceReconcileDeps = { catalog, repos };

  const entries: SeededDemoEntry[] = [];
  const byName: Record<string, SeededDemoEntry> = {};

  for (const scenario of DEMO_ORDER_SCENARIOS) {
    const entry = await seedOrderScenario(deps, reconcileDeps, scenario);
    entries.push(entry);
    byName[scenario.name] = entry;
  }

  const funding = await seedWalletFundingFailure(
    repos,
    registry.payment,
    DEMO_SEED_TIMESTAMP,
  );
  entries.push(funding);
  byName[WALLET_FUNDING_SCENARIO_NAME] = funding;

  return {
    transactions: entries,
    byName,
    ...buildAliasMaps(),
  };
}
