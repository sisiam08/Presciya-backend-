-- Structured prescription instruction fields (Section 13.1)
ALTER TABLE "prescription_medicines" ADD COLUMN     "applicationAmount" TEXT,
ADD COLUMN     "applicationArea" TEXT,
ADD COLUMN     "applicationFrequency" TEXT,
ADD COLUMN     "customScheduleJson" JSONB,
ADD COLUMN     "dose" TEXT,
ADD COLUMN     "durationUnit" TEXT,
ADD COLUMN     "durationValue" INTEGER,
ADD COLUMN     "frequencyMorning" INTEGER,
ADD COLUMN     "frequencyNight" INTEGER,
ADD COLUMN     "frequencyNoon" INTEGER,
ADD COLUMN     "specificDays" TEXT;
