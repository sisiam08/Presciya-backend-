-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN "serialNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_serialNumber_key" ON "Prescription"("serialNumber");
