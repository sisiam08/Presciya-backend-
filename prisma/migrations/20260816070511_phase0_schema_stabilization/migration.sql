-- CreateEnum
CREATE TYPE "OnboardingState" AS ENUM ('PROFILE_SETUP', 'VERIFICATION_SUBMITTED', 'VERIFICATION_APPROVED', 'READY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'ACCEPT_INVITE';
ALTER TYPE "AuditActionType" ADD VALUE 'REJECT_INVITE';
ALTER TYPE "AuditActionType" ADD VALUE 'STATUS_CHANGE';
ALTER TYPE "AuditActionType" ADD VALUE 'SUSPEND';
ALTER TYPE "AuditActionType" ADD VALUE 'RESTORE';
ALTER TYPE "AuditActionType" ADD VALUE 'SUBSCRIPTION_CHANGE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingState" "OnboardingState" NOT NULL DEFAULT 'PROFILE_SETUP';
