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
 * Assign a doctor to an institution
 */


/**
 * Get all doctors assigned to an institution
 */
const getInstitutionDoctors = async (institutionId: string) => {
  return await prisma.institutionDoctor.findMany({
    where: { institutionId },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialization: true,
          verificationStatus: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
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
    orderBy: { createdAt: "asc" },
  });
};

/**
 * Get institution doctor details
 */
const getInstitutionDoctorDetails = async (institutionDoctorId: string) => {
  const institutionDoctor = await prisma.institutionDoctor.findUnique({
    where: { id: institutionDoctorId },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialization: true,
          bmdcNumber: true,
          verificationStatus: true,
        },
      },
      institution: {
        select: { id: true, name: true },
      },
      department: {
        select: { id: true, name: true },
      },
      assignments: {
        include: {
          chamber: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!institutionDoctor) {
    throw createAppError("Doctor assignment not found", Status.NOT_FOUND);
  }

  return institutionDoctor;
};

/**
 * Update doctor assignment (change department, toggle active status)
 */
const updateDoctorAssignment = async (
  institutionDoctorId: string,
  userId: string,
  data: Partial<{
    departmentId: string | null;
    isActive: boolean;
  }>,
) => {
  // Verify user is verified
  await checkUserVerification(userId);

  const institutionDoctor = await prisma.institutionDoctor.findUnique({
    where: { id: institutionDoctorId },
    include: {
      institution: {
        select: { userId: true, name: true },
      },
      doctor: {
        select: { id: true, name: true },
      },
    },
  });

  if (!institutionDoctor) {
    throw createAppError("Doctor assignment not found", Status.NOT_FOUND);
  }

  // Verify user owns the institution
  if (institutionDoctor.institution.userId !== userId) {
    throw createAppError(
      "You don't have permission to update this assignment",
      Status.FORBIDDEN,
    );
  }

  // Verify new department belongs to institution if changing department
  if (data.departmentId !== undefined && data.departmentId !== null) {
    const department = await prisma.department.findUnique({
      where: {
        id: data.departmentId,
        institutionId: institutionDoctor.institutionId,
      },
    });

    if (!department) {
      throw createAppError(
        "Department not found in this institution",
        Status.NOT_FOUND,
      );
    }
  }

  // Update assignment
  const updated = await prisma.institutionDoctor.update({
    where: { id: institutionDoctorId },
    data,
  });

  // Audit: Log update
  await AuditService.logAudit({
    userId,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.SYSTEM,
    entityId: institutionDoctorId,
    oldValues: {
      departmentId: institutionDoctor.departmentId,
      isActive: institutionDoctor.isActive,
    },
    newValues: data,
    metadata: {
      doctorName: institutionDoctor.doctor.name,
      institutionName: institutionDoctor.institution.name,
    },
  });

  return updated;
};

/**
 * Remove doctor from institution
 */
const removeDoctorFromInstitution = async (
  institutionDoctorId: string,
  userId: string,
) => {
  // Verify user is verified
  await checkUserVerification(userId);

  const institutionDoctor = await prisma.institutionDoctor.findUnique({
    where: { id: institutionDoctorId },
    include: {
      institution: {
        select: { userId: true, name: true },
      },
      doctor: {
        select: { id: true, name: true },
      },
    },
  });

  if (!institutionDoctor) {
    throw createAppError("Doctor assignment not found", Status.NOT_FOUND);
  }

  // Verify user owns the institution
  if (institutionDoctor.institution.userId !== userId) {
    throw createAppError(
      "You don't have permission to remove this assignment",
      Status.FORBIDDEN,
    );
  }

  // Check if doctor has active assignments (chambers)
  const activeAssignments = await prisma.doctorAssignment.count({
    where: { institutionDoctorId },
  });

  if (activeAssignments > 0) {
    throw createAppError(
      "Cannot remove doctor with active chamber assignments. Please unassign chambers first.",
      Status.BAD_REQUEST,
    );
  }

  // Delete the assignment
  const deleted = await prisma.institutionDoctor.delete({
    where: { id: institutionDoctorId },
  });

  // Audit: Log removal
  await AuditService.logAudit({
    userId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.SYSTEM,
    entityId: institutionDoctorId,
    oldValues: {
      doctorId: deleted.doctorId,
      institutionId: deleted.institutionId,
    },
    metadata: {
      doctorName: institutionDoctor.doctor.name,
      institutionName: institutionDoctor.institution.name,
    },
  });

  return deleted;
};

export const InstitutionDoctorServices = {
  getInstitutionDoctors,
  getInstitutionDoctorDetails,
  updateDoctorAssignment,
  removeDoctorFromInstitution,
};
