-- DropIndex
DROP INDEX IF EXISTS "appointments_workspaceId_appointmentDate_serialNo_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_chamberId_idx" ON "appointments"("chamberId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_chamberId_appointmentDate_serialNo_key" ON "appointments"("chamberId", "appointmentDate", "serialNo");

-- Personal (chamber-less) appointments stay unique per workspace per day.
-- A nullable column cannot enforce uniqueness on its own, so this is a partial
-- index scoped to the personal rows only.
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_workspace_personal_serial_key"
  ON "appointments"("workspaceId", "appointmentDate", "serialNo")
  WHERE "chamberId" IS NULL;
