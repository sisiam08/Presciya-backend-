import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";

type TemplateInput = {
  name: string;
  description?: string;
  complaints?: string;
  advises?: string;
  medicines: unknown[];
};

/**
 * Prescription templates (Section 13.6). A template is only ever *copied into*
 * a new prescription — editing a prescription never mutates the template.
 */
const createTemplate = async (
  workspaceId: string,
  doctorUserId: string,
  data: TemplateInput,
) => {
  if (!data?.name || !data.name.trim()) {
    throw createAppError("Template name is required", Status.BAD_REQUEST);
  }

  if (!Array.isArray(data.medicines) || data.medicines.length === 0) {
    throw createAppError(
      "A template must contain at least one medicine",
      Status.BAD_REQUEST,
    );
  }

  return prisma.prescriptionTemplate.create({
    data: {
      workspaceId,
      doctorUserId,
      name: data.name.trim(),
      description: data.description ?? null,
      complaints: data.complaints ?? null,
      advises: data.advises ?? null,
      medicinesJson: data.medicines as any,
    },
  });
};

const listTemplates = async (workspaceId: string) => {
  return prisma.prescriptionTemplate.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
};

const getTemplate = async (id: string, workspaceId: string) => {
  const template = await prisma.prescriptionTemplate.findFirst({
    where: { id, workspaceId },
  });

  if (!template) {
    throw createAppError("Template not found", Status.NOT_FOUND);
  }

  return template;
};

const updateTemplate = async (
  id: string,
  workspaceId: string,
  data: Partial<TemplateInput>,
) => {
  await getTemplate(id, workspaceId);

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description;
  if (data.complaints !== undefined) updateData.complaints = data.complaints;
  if (data.advises !== undefined) updateData.advises = data.advises;
  if (data.medicines !== undefined) {
    if (!Array.isArray(data.medicines) || data.medicines.length === 0) {
      throw createAppError(
        "A template must contain at least one medicine",
        Status.BAD_REQUEST,
      );
    }
    updateData.medicinesJson = data.medicines;
  }

  return prisma.prescriptionTemplate.update({
    where: { id },
    data: updateData as any,
  });
};

const deleteTemplate = async (id: string, workspaceId: string) => {
  await getTemplate(id, workspaceId);
  await prisma.prescriptionTemplate.delete({ where: { id } });
};

export const TemplateServices = {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
