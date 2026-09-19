-- Phase 3: internal business finance (manual income/expense tracking).
-- Purely additive: new enum, two new tables, new audit entity values.

-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterEnum: audit entity types for finance
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'FINANCIAL_TRANSACTION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'FINANCIAL_CATEGORY';

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "prescriptionId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_categories_workspaceId_idx" ON "financial_categories"("workspaceId");
CREATE INDEX "financial_categories_type_idx" ON "financial_categories"("type");
CREATE UNIQUE INDEX "financial_categories_workspaceId_name_type_key" ON "financial_categories"("workspaceId", "name", "type");

-- CreateIndex
CREATE INDEX "financial_transactions_workspaceId_idx" ON "financial_transactions"("workspaceId");
CREATE INDEX "financial_transactions_transactionDate_idx" ON "financial_transactions"("transactionDate");
CREATE INDEX "financial_transactions_type_idx" ON "financial_transactions"("type");
CREATE INDEX "financial_transactions_categoryId_idx" ON "financial_transactions"("categoryId");
CREATE INDEX "financial_transactions_workspaceId_transactionDate_idx" ON "financial_transactions"("workspaceId", "transactionDate");
CREATE INDEX "financial_transactions_workspaceId_type_transactionDate_idx" ON "financial_transactions"("workspaceId", "type", "transactionDate");

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
