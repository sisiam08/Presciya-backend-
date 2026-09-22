-- Additive only: On Examination (O/E) findings and past medical history on the
-- prescription, plus the ordered investigation list. Every new column is
-- nullable and the new table starts empty, so existing prescriptions load and
-- render exactly as before.

ALTER TABLE "Prescription"
  ADD COLUMN "history" TEXT,
  ADD COLUMN "examRespiratoryRate" TEXT,
  ADD COLUMN "examLungs" TEXT,
  ADD COLUMN "examHeart" TEXT,
  ADD COLUMN "examAnaemia" TEXT,
  ADD COLUMN "examCyanosis" TEXT,
  ADD COLUMN "examOedema" TEXT,
  ADD COLUMN "examDehydration" TEXT,
  ADD COLUMN "examOthers" TEXT;

CREATE TABLE "prescription_investigations" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_investigations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prescription_investigations_prescriptionId_idx"
  ON "prescription_investigations"("prescriptionId");

ALTER TABLE "prescription_investigations"
  ADD CONSTRAINT "prescription_investigations_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
