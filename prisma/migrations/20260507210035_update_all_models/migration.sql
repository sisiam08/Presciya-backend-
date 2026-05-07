/*
  Warnings:

  - You are about to drop the column `address` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `footerText` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `isDefault` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `slogan` on the `chambers` table. All the data in the column will be lost.
  - You are about to drop the column `signatureUrl` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `dosagePattern` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `orderIndex` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `prescriptionId` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `specialNote` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `whenToTake` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `patientId` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `pdfUrl` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `prescriptionDate` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `prescriptionNo` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `qrCode` on the `prescriptions` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `frequent_medicines` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `medicines` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chamberAddress` to the `chambers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chamberName` to the `chambers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signature` to the `doctors` table without a default value. This is not possible if the table is not empty.
  - Made the column `qualification` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `specialization` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `registrationNo` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `brandName` to the `medicines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dosageForm` to the `medicines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `generic` to the `medicines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `medicines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `medicines` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `gender` on the `patients` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `dosagePattern` to the `prescriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration` to the `prescriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `medicines` to the `prescriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `whenToTake` to the `prescriptions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DoctorType" AS ENUM ('PERSONAL', 'INSTITUTIONAL');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ContactLabel" AS ENUM ('RECEPTION', 'EMERGENCY', 'AMBULANCE', 'MANAGER', 'DOCTOR', 'PHARMACY', 'LAB', 'ASSISTANT', 'OTHER');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'INSTITUTION';

-- DropForeignKey
ALTER TABLE "frequent_medicines" DROP CONSTRAINT "frequent_medicines_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "medicines" DROP CONSTRAINT "medicines_prescriptionId_fkey";

-- DropForeignKey
ALTER TABLE "patients" DROP CONSTRAINT "patients_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_chamberId_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_patientId_fkey";

-- DropIndex
DROP INDEX "patients_patientId_key";

-- DropIndex
DROP INDEX "prescriptions_prescriptionNo_key";

-- AlterTable
ALTER TABLE "chambers" DROP COLUMN "address",
DROP COLUMN "email",
DROP COLUMN "footerText",
DROP COLUMN "isDefault",
DROP COLUMN "logoUrl",
DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "slogan",
ADD COLUMN     "chamberAddress" TEXT NOT NULL,
ADD COLUMN     "chamberEmail" TEXT,
ADD COLUMN     "chamberName" TEXT NOT NULL,
ADD COLUMN     "chamberSlogan" TEXT,
ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "signatureUrl",
ADD COLUMN     "signature" TEXT NOT NULL,
ADD COLUMN     "type" "DoctorType" NOT NULL DEFAULT 'PERSONAL',
ALTER COLUMN "qualification" SET NOT NULL,
ALTER COLUMN "specialization" SET NOT NULL,
ALTER COLUMN "registrationNo" SET NOT NULL;

-- AlterTable
ALTER TABLE "medicines" DROP COLUMN "dosagePattern",
DROP COLUMN "duration",
DROP COLUMN "name",
DROP COLUMN "orderIndex",
DROP COLUMN "prescriptionId",
DROP COLUMN "specialNote",
DROP COLUMN "whenToTake",
ADD COLUMN     "brandName" TEXT NOT NULL,
ADD COLUMN     "dosageForm" TEXT NOT NULL,
ADD COLUMN     "generic" TEXT NOT NULL,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "patientId",
ALTER COLUMN "doctorId" SET DEFAULT '00000000-0000-0000-0000-000000000000',
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender" NOT NULL;

-- AlterTable
ALTER TABLE "prescriptions" DROP COLUMN "pdfUrl",
DROP COLUMN "prescriptionDate",
DROP COLUMN "prescriptionNo",
DROP COLUMN "qrCode",
ADD COLUMN     "advises" TEXT,
ADD COLUMN     "dosagePattern" TEXT NOT NULL,
ADD COLUMN     "duration" TEXT NOT NULL,
ADD COLUMN     "medicines" JSONB NOT NULL,
ADD COLUMN     "pdf" TEXT,
ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "whenToTake" TEXT NOT NULL,
ALTER COLUMN "doctorId" SET DEFAULT '00000000-0000-0000-0000-000000000000',
ALTER COLUMN "chamberId" DROP NOT NULL,
ALTER COLUMN "patientId" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "isActive",
DROP COLUMN "phone",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "slogan" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "frequent_medicines";

-- CreateTable
CREATE TABLE "contact_numbers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "chamberId" TEXT,
    "label" "ContactLabel" NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contact_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_variants" (
    "id" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "description" JSONB NOT NULL,
    "dailyPrescriptionLimit" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionVariantId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    "voucherCode" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "discountPercentage" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "medicines_slug_key" ON "medicines"("slug");

-- CreateIndex
CREATE INDEX "medicines_slug_idx" ON "medicines"("slug");

-- AddForeignKey
ALTER TABLE "contact_numbers" ADD CONSTRAINT "contact_numbers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_numbers" ADD CONSTRAINT "contact_numbers_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "chambers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "chambers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriptionVariantId_fkey" FOREIGN KEY ("subscriptionVariantId") REFERENCES "subscription_variants"("id") ON DELETE SET DEFAULT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_voucherCode_fkey" FOREIGN KEY ("voucherCode") REFERENCES "vouchers"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
