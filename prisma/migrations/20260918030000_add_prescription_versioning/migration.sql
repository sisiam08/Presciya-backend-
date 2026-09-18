-- Correction/versioning support (Section 13.4)
ALTER TABLE "Prescription" ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Prescription_supersedesId_idx" ON "Prescription"("supersedesId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
