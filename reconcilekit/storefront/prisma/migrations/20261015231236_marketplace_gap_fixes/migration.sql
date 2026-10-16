/*
  Warnings:

  - You are about to drop the column `amount_minor` on the `marketplace_orders` table. All the data in the column will be lost.
  - Added the required column `customer_reference` to the `marketplace_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quoted_amount_minor` to the `marketplace_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `marketplace_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider_id` to the `marketplace_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_id` to the `marketplace_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "marketplace_orders" DROP COLUMN "amount_minor",
ADD COLUMN     "customer_reference" TEXT NOT NULL,
ADD COLUMN     "quoted_amount_minor" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "marketplace_transactions" ADD COLUMN     "provider_id" TEXT NOT NULL,
ADD COLUMN     "service_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "marketplace_payments" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "wallet_reference" TEXT NOT NULL,
    "provider_reference" TEXT,
    "expected_amount_minor" INTEGER NOT NULL,
    "actual_amount_minor" INTEGER,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_payments_transaction_id_idx" ON "marketplace_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "marketplace_payments_order_id_idx" ON "marketplace_payments"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_payments_customer_id_idx" ON "marketplace_payments"("customer_id");

-- AddForeignKey
ALTER TABLE "marketplace_payments" ADD CONSTRAINT "marketplace_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_payments" ADD CONSTRAINT "marketplace_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "marketplace_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
