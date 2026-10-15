-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'OPERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active_org_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_customers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "is_demo" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_transactions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "fulfillment_status" TEXT NOT NULL,
    "reconcile_outcome" TEXT,
    "resolution_status" TEXT NOT NULL,
    "customer_status" TEXT NOT NULL,
    "admin_status" TEXT NOT NULL,
    "demo_scenario_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_provider_attempts" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "request_reference" TEXT NOT NULL,
    "provider_reference" TEXT,
    "status" TEXT NOT NULL,
    "canonical_status" TEXT,
    "amount_minor" INTEGER,
    "currency" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "source_attributes" JSONB NOT NULL,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_provider_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "opening_balance_minor" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "type" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_packs" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "customer_reference" TEXT NOT NULL,
    "provider_reference" TEXT,
    "payment_reference" TEXT,
    "service_snapshot" JSONB NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "timeline_event_ids" TEXT[],
    "provider_facts" JSONB NOT NULL,
    "reconciliation" JSONB,
    "mismatch_flags" TEXT[],
    "resolution_status" TEXT NOT NULL,
    "audit_event_ids" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "evidence_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_events" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "actor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "transaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "evidence_pack_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "ledger_reference" TEXT,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reversals" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "ledger_reference" TEXT,

    CONSTRAINT "reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolution_note" TEXT,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_reviews" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assigned_to" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "operator_note" TEXT,

    CONSTRAINT "manual_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_artifacts" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "ticket_kind" TEXT NOT NULL,
    "reservation_reference" TEXT,
    "issue_reference" TEXT,
    "passenger_or_attendee" TEXT NOT NULL,
    "route_or_venue" TEXT NOT NULL,
    "seat" TEXT,
    "status" TEXT NOT NULL,
    "masked_code" TEXT,
    "issued_at" TIMESTAMPTZ(6),
    "cancellation_reference" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "ticket_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_artifacts" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "denomination_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "delivery_status" TEXT NOT NULL,
    "redemption_status" TEXT NOT NULL,
    "masked_code_preview" TEXT,
    "risk_flags" TEXT[],

    CONSTRAINT "gift_card_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "transaction_id" TEXT,
    "merchant_reference" TEXT,
    "payment_source" TEXT NOT NULL,
    "payment_source_reference" TEXT,
    "source_event_id" TEXT,
    "event_type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT,
    "occurred_at" TIMESTAMPTZ(6),
    "source_confidence" TEXT NOT NULL,
    "source_attributes" JSONB NOT NULL,
    "observed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_categories" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "compliance_status" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_services" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "base_amount_minor" INTEGER NOT NULL,
    "compliance_status" TEXT NOT NULL,
    "fulfillment_type" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "input_schema" JSONB NOT NULL,

    CONSTRAINT "catalog_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fulfillment_type" TEXT NOT NULL,
    "pricing" JSONB NOT NULL,
    "availability" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "expected_amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paystack_reference" TEXT,
    "authorization_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "expected_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paystack_reference" TEXT,
    "status" TEXT NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "refund_status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_active_org_id_idx" ON "sessions"("active_org_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "memberships_org_id_idx" ON "memberships"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_org_id_key" ON "memberships"("user_id", "org_id");

-- CreateIndex
CREATE INDEX "marketplace_customers_org_id_idx" ON "marketplace_customers"("org_id");

-- CreateIndex
CREATE INDEX "marketplace_orders_customer_id_idx" ON "marketplace_orders"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_transactions_reference_key" ON "marketplace_transactions"("reference");

-- CreateIndex
CREATE INDEX "marketplace_transactions_customer_id_idx" ON "marketplace_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "marketplace_transactions_order_id_idx" ON "marketplace_transactions"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_transactions_demo_scenario_name_idx" ON "marketplace_transactions"("demo_scenario_name");

-- CreateIndex
CREATE INDEX "marketplace_provider_attempts_transaction_id_idx" ON "marketplace_provider_attempts"("transaction_id");

-- CreateIndex
CREATE INDEX "wallets_customer_id_idx" ON "wallets"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_ledger_wallet_id_idx" ON "wallet_ledger"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_ledger_transaction_id_idx" ON "wallet_ledger"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_packs_transaction_id_key" ON "evidence_packs"("transaction_id");

-- CreateIndex
CREATE INDEX "transaction_events_transaction_id_idx" ON "transaction_events"("transaction_id");

-- CreateIndex
CREATE INDEX "receipts_transaction_id_idx" ON "receipts"("transaction_id");

-- CreateIndex
CREATE INDEX "refunds_transaction_id_idx" ON "refunds"("transaction_id");

-- CreateIndex
CREATE INDEX "reversals_transaction_id_idx" ON "reversals"("transaction_id");

-- CreateIndex
CREATE INDEX "disputes_transaction_id_idx" ON "disputes"("transaction_id");

-- CreateIndex
CREATE INDEX "disputes_customer_id_idx" ON "disputes"("customer_id");

-- CreateIndex
CREATE INDEX "manual_reviews_transaction_id_idx" ON "manual_reviews"("transaction_id");

-- CreateIndex
CREATE INDEX "ticket_artifacts_transaction_id_idx" ON "ticket_artifacts"("transaction_id");

-- CreateIndex
CREATE INDEX "gift_card_artifacts_transaction_id_idx" ON "gift_card_artifacts"("transaction_id");

-- CreateIndex
CREATE INDEX "notifications_customer_id_idx" ON "notifications"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_event_id_key" ON "payment_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_idempotency_key_key" ON "payment_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_events_payment_source_reference_idx" ON "payment_events"("payment_source_reference");

-- CreateIndex
CREATE INDEX "payment_events_transaction_id_idx" ON "payment_events"("transaction_id");

-- CreateIndex
CREATE INDEX "catalog_services_category_id_idx" ON "catalog_services"("category_id");

-- CreateIndex
CREATE INDEX "catalog_products_service_id_idx" ON "catalog_products"("service_id");

-- CreateIndex
CREATE INDEX "catalog_products_category_id_idx" ON "catalog_products"("category_id");

-- CreateIndex
CREATE INDEX "products_business_id_idx" ON "products"("business_id");

-- CreateIndex
CREATE INDEX "orders_business_id_idx" ON "orders"("business_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_business_id_idx" ON "payments"("business_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_org_id_fkey" FOREIGN KEY ("active_org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_customers" ADD CONSTRAINT "marketplace_customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_provider_attempts" ADD CONSTRAINT "marketplace_provider_attempts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_packs" ADD CONSTRAINT "evidence_packs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_evidence_pack_id_fkey" FOREIGN KEY ("evidence_pack_id") REFERENCES "evidence_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reversals" ADD CONSTRAINT "reversals_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_reviews" ADD CONSTRAINT "manual_reviews_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_artifacts" ADD CONSTRAINT "ticket_artifacts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_artifacts" ADD CONSTRAINT "gift_card_artifacts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_services" ADD CONSTRAINT "catalog_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "catalog_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
