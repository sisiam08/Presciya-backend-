import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { checkUserVerification } from "../../utils/verificationCheck";


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


const createDepartment = async (
  userId: string,
  institutionId: string,
  data: {
    name: string;
    description?: string;
  },
) => {
  
  await checkUserVerification(userId);

  
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

  
  const department = await createDepartmentForInstitution(
    institutionId,
    data,
  );

  
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


const getDepartmentsByInstitution = async (institutionId: string) => {
  return await listDepartmentsForInstitution(institutionId);
};


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


const updateDepartment = async (
  departmentId: string,
  userId: string,
  data: Partial<{
    name: string;
    description: string;
  }>,
) => {
  
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

  
  if (department.institution.userId !== userId) {
    throw createAppError(
      "You don't have permission to update this department",
      Status.FORBIDDEN,
    );
  }

  
  const updated = await prisma.department.update({
    where: { id: departmentId },
    data,
  });

  
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


const deleteDepartment = async (departmentId: string, userId: string) => {
  
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

  
  if (department.institution.userId !== userId) {
    throw createAppError(
      "You don't have permission to delete this department",
      Status.FORBIDDEN,
    );
  }

  
  const doctorCount = await prisma.institutionDoctor.count({
    where: { departmentId },
  });

  if (doctorCount > 0) {
    throw createAppError(
      "Cannot delete department with assigned doctors. Please reassign them first.",
      Status.BAD_REQUEST,
    );
  }

  
  const deleted = await prisma.department.delete({
    where: { id: departmentId },
  });

  
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
