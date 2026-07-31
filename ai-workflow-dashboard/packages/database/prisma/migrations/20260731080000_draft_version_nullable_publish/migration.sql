-- AlterTable
ALTER TABLE "workflow_versions" ALTER COLUMN "published_by" DROP NOT NULL,
ALTER COLUMN "published_at" DROP NOT NULL;

