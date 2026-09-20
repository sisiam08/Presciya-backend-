-- Personal-workspace prescriptions are not tied to a chamber, so a chamber is
-- no longer mandatory. Chamber/institution prescriptions keep setting it.
-- Existing rows are untouched.
ALTER TABLE "Prescription" ALTER COLUMN "chamberId" DROP NOT NULL;
