import type { Prisma, PrismaClient } from "@prisma/client";
import { UserRepository } from "./users.ts";
import { WalletRepository } from "./wallets.ts";
import { WalletLedgerRepository } from "./wallet-ledger.ts";
import { TransactionEventRepository } from "./transaction-events.ts";
import { RefundRepository } from "./refunds.ts";
import { ReversalRepository } from "./reversals.ts";
import { DisputeRepository } from "./disputes.ts";
import { ManualReviewRepository } from "./manual-reviews.ts";
import { ReceiptRepository } from "./receipts.ts";
import { NotificationRepository } from "./notifications.ts";
import { SessionRepository } from "./sessions.ts";
import { OrganizationRepository } from "./organizations.ts";
import { MembershipRepository } from "./memberships.ts";
import { CatalogCategoryRepository } from "./catalog-categories.ts";
import { CatalogServiceRepository } from "./catalog-services.ts";
import { CatalogProductRepository } from "./catalog-products.ts";
import { MarketplaceCustomerRepository } from "./marketplace-customers.ts";
import { MarketplaceOrderRepository } from "./marketplace-orders.ts";
import { MarketplaceTransactionRepository } from "./marketplace-transactions.ts";
import { MarketplacePaymentRepository } from "./marketplace-payments.ts";
import { MarketplaceProviderAttemptRepository } from "./marketplace-provider-attempts.ts";
import { EvidencePackRepository } from "./evidence-packs.ts";
import { TicketArtifactRepository } from "./ticket-artifacts.ts";
import { GiftCardArtifactRepository } from "./gift-card-artifacts.ts";
import { PaymentEventRepository } from "./payment-events.ts";
import { BusinessRepository } from "./businesses.ts";
import { ProductRepository } from "./products.ts";
import { OrderRepository } from "./orders.ts";
import { PaymentRepository } from "./payments.ts";

export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export interface Repositories {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly organizations: OrganizationRepository;
  readonly memberships: MembershipRepository;
  readonly wallets: WalletRepository;
  readonly walletLedger: WalletLedgerRepository;
  readonly transactionEvents: TransactionEventRepository;
  readonly refunds: RefundRepository;
  readonly reversals: ReversalRepository;
  readonly disputes: DisputeRepository;
  readonly manualReviews: ManualReviewRepository;
  readonly receipts: ReceiptRepository;
  readonly notifications: NotificationRepository;
  readonly catalogCategories: CatalogCategoryRepository;
  readonly catalogServices: CatalogServiceRepository;
  readonly catalogProducts: CatalogProductRepository;
  readonly marketplaceCustomers: MarketplaceCustomerRepository;
  readonly marketplaceOrders: MarketplaceOrderRepository;
  readonly marketplaceTransactions: MarketplaceTransactionRepository;
  readonly marketplacePayments: MarketplacePaymentRepository;
  readonly marketplaceProviderAttempts: MarketplaceProviderAttemptRepository;
  readonly ticketArtifacts: TicketArtifactRepository;
  readonly giftCardArtifacts: GiftCardArtifactRepository;
  readonly evidencePacks: EvidencePackRepository;
  readonly paymentEvents: PaymentEventRepository;
  readonly businesses: BusinessRepository;
  readonly products: ProductRepository;
  readonly orders: OrderRepository;
  readonly payments: PaymentRepository;
  // Placeholder lines below are filled in as each repository lands.
  //
  // readonly ticketArtifacts: TicketArtifactRepository;
  // readonly giftCardArtifacts: GiftCardArtifactRepository;
}

export function buildRepositories(client: RepositoryClient): Repositories {
  return {
    users: new UserRepository(client),
    sessions: new SessionRepository(client),
    organizations: new OrganizationRepository(client),
    memberships: new MembershipRepository(client),
    wallets: new WalletRepository(client),
    walletLedger: new WalletLedgerRepository(client),
    transactionEvents: new TransactionEventRepository(client),
    refunds: new RefundRepository(client),
    reversals: new ReversalRepository(client),
    disputes: new DisputeRepository(client),
    manualReviews: new ManualReviewRepository(client),
    receipts: new ReceiptRepository(client),
    notifications: new NotificationRepository(client),
    catalogCategories: new CatalogCategoryRepository(client),
    catalogServices: new CatalogServiceRepository(client),
    catalogProducts: new CatalogProductRepository(client),
    marketplaceCustomers: new MarketplaceCustomerRepository(client),
    marketplaceOrders: new MarketplaceOrderRepository(client),
    marketplaceTransactions: new MarketplaceTransactionRepository(client),
    marketplacePayments: new MarketplacePaymentRepository(client),
    marketplaceProviderAttempts: new MarketplaceProviderAttemptRepository(
      client,
    ),
    ticketArtifacts: new TicketArtifactRepository(client),
    giftCardArtifacts: new GiftCardArtifactRepository(client),
    paymentEvents: new PaymentEventRepository(client),
    evidencePacks: new EvidencePackRepository(client),
    businesses: new BusinessRepository(client),
    products: new ProductRepository(client),
    orders: new OrderRepository(client),
    payments: new PaymentRepository(client),
  };
}
