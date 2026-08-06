-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "failureType" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "recommendedFix" TEXT NOT NULL,
    "preventionStrategy" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "redactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportStep" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "outcome" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,

    CONSTRAINT "ReportStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "severity" TEXT NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReportStep" ADD CONSTRAINT "ReportStep_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
