-- Phase 1: prescription language settings
-- Phase 2: multiple prescription design templates
-- Purely additive: new enums + nullable/defaulted columns. No data is dropped.

-- CreateEnum
CREATE TYPE "PrescriptionLanguage" AS ENUM ('ENGLISH', 'BANGLA');

-- CreateEnum
CREATE TYPE "PrescriptionDesignTemplate" AS ENUM ('DEFAULT', 'MODERN_CLINICAL', 'MINIMAL_PROFESSIONAL', 'MODERN_MEDICAL', 'ELEGANT_COMPACT');

-- AlterTable: doctor rendering defaults
ALTER TABLE "Doctor"
  ADD COLUMN "prescriptionLanguage" "PrescriptionLanguage" NOT NULL DEFAULT 'ENGLISH',
  ADD COLUMN "prescriptionTemplate" "PrescriptionDesignTemplate" NOT NULL DEFAULT 'DEFAULT';

-- AlterTable: per-prescription frozen rendering choice + branding snapshot
ALTER TABLE "Prescription"
  ADD COLUMN "language" "PrescriptionLanguage" NOT NULL DEFAULT 'ENGLISH',
  ADD COLUMN "template" "PrescriptionDesignTemplate" NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN "renderSnapshot" JSONB;
