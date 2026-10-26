-- AlterTable
ALTER TABLE "marketplace_payments" ADD COLUMN     "simulated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "marketplace_provider_attempts" ADD COLUMN     "simulated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "marketplace_transactions" ADD COLUMN     "simulated" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "transaction_events" ADD COLUMN     "simulated" BOOLEAN NOT NULL DEFAULT true;
