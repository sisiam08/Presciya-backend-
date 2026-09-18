-- Prescription templates (Section 13.6)
CREATE TABLE "prescription_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "complaints" TEXT,
    "advises" TEXT,
    "medicinesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_templates_workspaceId_idx" ON "prescription_templates"("workspaceId");

-- CreateIndex
CREATE INDEX "prescription_templates_doctorUserId_idx" ON "prescription_templates"("doctorUserId");

-- AddForeignKey
ALTER TABLE "prescription_templates" ADD CONSTRAINT "prescription_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_templates" ADD CONSTRAINT "prescription_templates_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
