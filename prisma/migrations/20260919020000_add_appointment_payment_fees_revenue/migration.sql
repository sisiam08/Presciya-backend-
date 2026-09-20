-- Phases 1-5: workspace context, visiting fees, revenue share, appointment payments.
-- Additive except for the appointment unique-constraint swap (no existing rows).

-- AlterEnum: add CHAMBER to WorkspaceType
ALTER TYPE "WorkspaceType" ADD VALUE IF NOT EXISTS 'CHAMBER';

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('HOSPITAL', 'CLINIC');
CREATE TYPE "AppointmentType" AS ENUM ('NORMAL', 'FOLLOW_UP');
CREATE TYPE "AppointmentPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FREE', 'CANCELLED', 'REFUNDED');

-- AlterTable: Workspace.institutionType
ALTER TABLE "Workspace" ADD COLUMN "institutionType" "InstitutionType";

-- CreateTable: doctor_visiting_fees
CREATE TABLE "doctor_visiting_fees" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "visitingFee" DECIMAL(12,2) NOT NULL,
    "followUpFee" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_visiting_fees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctor_visiting_fees_doctorId_workspaceId_key" ON "doctor_visiting_fees"("doctorId", "workspaceId");
CREATE INDEX "doctor_visiting_fees_workspaceId_idx" ON "doctor_visiting_fees"("workspaceId");

ALTER TABLE "doctor_visiting_fees" ADD CONSTRAINT "doctor_visiting_fees_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_visiting_fees" ADD CONSTRAINT "doctor_visiting_fees_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: revenue_share_configs
CREATE TABLE "revenue_share_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "doctorId" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_share_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revenue_share_configs_workspaceId_doctorId_key" ON "revenue_share_configs"("workspaceId", "doctorId");
CREATE INDEX "revenue_share_configs_workspaceId_idx" ON "revenue_share_configs"("workspaceId");

ALTER TABLE "revenue_share_configs" ADD CONSTRAINT "revenue_share_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revenue_share_configs" ADD CONSTRAINT "revenue_share_configs_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: appointments
ALTER TABLE "appointments"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "appointmentType" "AppointmentType" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "visitingFee" DECIMAL(12,2),
  ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "payableAmount" DECIMAL(12,2),
  ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentStatus" "AppointmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "revenueSharePercent" DECIMAL(5,2),
  ADD COLUMN "hospitalShareAmount" DECIMAL(12,2),
  ADD COLUMN "doctorShareAmount" DECIMAL(12,2),
  ADD COLUMN "followUpOfId" TEXT;

ALTER TABLE "appointments" ALTER COLUMN "chamberId" DROP NOT NULL;

-- Backfill workspaceId from the chamber for any pre-existing rows.
UPDATE "appointments" a
SET "workspaceId" = c."workspaceId"
FROM "Chamber" c
WHERE a."chamberId" = c."id" AND a."workspaceId" IS NULL;

ALTER TABLE "appointments" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Serial numbers become workspace-scoped + daily.
DROP INDEX IF EXISTS "appointments_chamberId_doctorId_appointmentDate_serialNo_key";
CREATE UNIQUE INDEX "appointments_workspaceId_appointmentDate_serialNo_key" ON "appointments"("workspaceId", "appointmentDate", "serialNo");

CREATE INDEX "appointments_workspaceId_idx" ON "appointments"("workspaceId");
CREATE INDEX "appointments_paymentStatus_idx" ON "appointments"("paymentStatus");
CREATE INDEX "appointments_followUpOfId_idx" ON "appointments"("followUpOfId");

ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_chamberId_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Prescription.appointmentId
ALTER TABLE "Prescription" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
