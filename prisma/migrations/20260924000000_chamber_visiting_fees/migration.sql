-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_chamberId_fkey";

-- DropIndex
DROP INDEX "doctor_visiting_fees_doctorId_workspaceId_key";

-- AlterTable
ALTER TABLE "doctor_visiting_fees" ADD COLUMN     "chamberId" TEXT;

-- CreateIndex
CREATE INDEX "doctor_visiting_fees_chamberId_idx" ON "doctor_visiting_fees"("chamberId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_visiting_fees_doctorId_chamberId_key" ON "doctor_visiting_fees"("doctorId", "chamberId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_visiting_fees" ADD CONSTRAINT "doctor_visiting_fees_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
