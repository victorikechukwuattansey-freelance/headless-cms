-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_reportId_fkey";

-- DropForeignKey
ALTER TABLE "ReportStep" DROP CONSTRAINT "ReportStep_reportId_fkey";

-- DropTable
DROP TABLE "Evidence";

-- DropTable
DROP TABLE "Report";

-- DropTable
DROP TABLE "ReportStep";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "redactions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'analyzed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedExecution" (
    "id" TEXT NOT NULL,
    "uploadedLogId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParsedExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureReport" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "failureType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rootCause" TEXT NOT NULL,
    "recommendedFix" TEXT NOT NULL,
    "preventionStrategy" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "UploadedLog_projectId_idx" ON "UploadedLog"("projectId");

-- CreateIndex
CREATE INDEX "UploadedLog_createdAt_idx" ON "UploadedLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedExecution_uploadedLogId_key" ON "ParsedExecution"("uploadedLogId");

-- CreateIndex
CREATE UNIQUE INDEX "FailureReport_executionId_key" ON "FailureReport"("executionId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedLog" ADD CONSTRAINT "UploadedLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedExecution" ADD CONSTRAINT "ParsedExecution_uploadedLogId_fkey" FOREIGN KEY ("uploadedLogId") REFERENCES "UploadedLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailureReport" ADD CONSTRAINT "FailureReport_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ParsedExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

