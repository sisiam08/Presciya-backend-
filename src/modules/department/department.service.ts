import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { checkUserVerification } from "../../utils/verificationCheck";

/**
 * Low-level department creation. Shared by the workspace-scoped
 * `institution/departments` surface and the standalone `/departments` module so
 * there is exactly one write path (Section 10.2).
 */
const createDepartmentForInstitution = async (
  institutionId: string,
  data: {
    name: string;
    description?: string;
  },
) => {
  return prisma.department.create({
    data: {
      institutionId,
      name: data.name,
      description: data.description ?? null,
    },
  });
};

/**
 * Low-level department listing for an institution (with assigned doctors).
 */
const listDepartmentsForInstitution = async (institutionId: string) => {
  return prisma.department.findMany({
    where: { institutionId },
    include: {
      doctors: {
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialization: true,
              verificationStatus: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

/**
 * Create a new department in an institution
 */
const createDepartment = async (
  userId: string,
  institutionId: string,
  data: {
    name: string;
    description?: string;
  },
) => {
  // Verify user is verified to perform this action
  await checkUserVerification(userId);

  // Verify user owns the institution
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId, userId },
    select: { id: true, name: true },
  });

  if (!institution) {
    throw createAppError(
      "Institution not found or you don't have permission",
      Status.FORBIDDEN,
    );
  }

  // Create department
  const department = await createDepartmentForInstitution(
    institutionId,
    data,
  );

  // Audit: Log department creation
  await AuditService.logAudit({
    userId,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.SYSTEM,
    entityId: department.id,
    newValues: {
      name: department.name,
      institutionId,
    },
    metadata: {
      departmentName: department.name,
      institutionName: institution.name,
    },
  });

  return department;
};

/**
 * Get all departments for an institution
 */
const getDepartmentsByInstitution = async (institutionId: string) => {
  return await listDepartmentsForInstitution(institutionId);
};

/**
 * Get department details
 */
const getDepartmentDetails = async (departmentId: string) => {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      institution: {
        select: { id: true, name: true },
      },
      doctors: {
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialization: true,
              verificationStatus: true,
            },
          },
          assignments: {
            include: {
              chamber: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!department) {
    throw createAppError("Department not found", Status.NOT_FOUND);
  }

  return department;
};

/**
 * Update department
 */
const updateDepartment = async (
  departmentId: string,
  userId: string,
  data: Partial<{
    name: string;
    description: string;
  }>,
) => {
  // Verify user is verified
  await checkUserVerification(userId);

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      institution: {
        select: { userId: true, name: true },
      },
    },
  });

  if (!department) {
    throw createAppError("Department not found", Status.NOT_FOUND);
  }

  // Verify user owns the institution
  if (department.institution.userId !== userId) {
    throw createAppError(
      "You don't have permission to update this department",
      Status.FORBIDDEN,
    );
  }

  // Update department
  const updated = await prisma.department.update({
    where: { id: departmentId },
    data,
  });

  // Audit: Log department update
  await AuditService.logAudit({
    userId,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.SYSTEM,
    entityId: departmentId,
    oldValues: {
      name: department.name,
      description: department.description,
    },
    newValues: data,
    metadata: {
      departmentName: updated.name,
      institutionName: department.institution.name,
    },
  });

  return updated;
};

/**
 * Delete department
 */
const deleteDepartment = async (departmentId: string, userId: string) => {
  // Verify user is verified
  await checkUserVerification(userId);

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      institution: {
        select: { userId: true, name: true },
      },
    },
  });

  if (!department) {
    throw createAppError("Department not found", Status.NOT_FOUND);
  }

  // Verify user owns the institution
  if (department.institution.userId !== userId) {
    throw createAppError(
      "You don't have permission to delete this department",
      Status.FORBIDDEN,
    );
  }

  // Check if department has doctors assigned
  const doctorCount = await prisma.institutionDoctor.count({
    where: { departmentId },
  });

  if (doctorCount > 0) {
    throw createAppError(
      "Cannot delete department with assigned doctors. Please reassign them first.",
      Status.BAD_REQUEST,
    );
  }

  // Delete department
  const deleted = await prisma.department.delete({
    where: { id: departmentId },
  });

  // Audit: Log department deletion
  await AuditService.logAudit({
    userId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.SYSTEM,
    entityId: departmentId,
    oldValues: {
      name: deleted.name,
      description: deleted.description,
    },
    metadata: {
      institutionName: department.institution.name,
    },
  });

  return deleted;
};

export const DepartmentServices = {
  createDepartmentForInstitution,
  listDepartmentsForInstitution,
  createDepartment,
  getDepartmentsByInstitution,
  getDepartmentDetails,
  updateDepartment,
  deleteDepartment,
};
