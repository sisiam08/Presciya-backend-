import { IAssignDoctor, IUpdateDoctorProfile } from "../../interface";
import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  VerificationStatus,
  WorkspaceType,
  WorkspaceRole,
  MembershipStatus,
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { deleteFileFromCloudinary } from "../../config/cloudinary.config";
import { invitationService } from "../invitation/invitation.service";
import { AuditService } from "../audit/audit.service";
import { checkUserVerification } from "../../utils/verificationCheck";

const assignDoctor = async (
  doctorData: IAssignDoctor,
  workspaceId: string,
  invitedById: string,
) => {
  // Check if the person assigning the doctor is verified to perform this action
  await checkUserVerification(invitedById);

  const { name, email, dummyPassword, departmentId } = doctorData;

  const result = await invitationService.inviteUser(
    workspaceId,
    email,
    WorkspaceRole.DOCTOR,
    invitedById,
    name,
    dummyPassword,
    departmentId!,
  );

  const resutl = await prisma.$transaction(async (tx) => {
    // Check if doctor profile already exists for this user
    let doctorProfile = await tx.doctor.findUnique({
      where: { userId: result.user.id },
    });

    if (!doctorProfile) {
      // Create new doctor profile
      doctorProfile = await tx.doctor.create({
        data: {
          name,
          userId: result.user.id,
          verificationStatus: VerificationStatus.PENDING,
        },
      });
    }
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, type: true },
    });

    if (workspace?.type === WorkspaceType.INSTITUTION) {
      const institution = await tx.institution.findUnique({
        where: { userId: workspace.ownerId },
        select: { id: true },
      });

      if (institution) {
        const existingAssignment = await tx.institutionDoctor.findUnique({
          where: {
            institutionId_doctorId: {
              institutionId: institution.id,
              doctorId: doctorProfile.id,
            },
          },
        });

        if (!existingAssignment) {
          await tx.institutionDoctor.create({
            data: {
              institutionId: institution.id,
              doctorId: doctorProfile.id,
              departmentId: departmentId ?? null,
            },
          });
        }
      }
    }

    await AuditService.logAudit({
      userId: invitedById,
      workspaceId,
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.USER,
      entityId: result.user.id,
      newValues: {
        name,
        email,
        role: WorkspaceRole.DOCTOR,
        verificationStatus: VerificationStatus.PENDING,
      },
      metadata: {
        doctorName: name,
        doctorEmail: email,
        workspaceId,
      },
    });
  });

  return {
    user: result.user,
  };
};

const getDoctorProfile = async (userId: string) => {
  return await prisma.doctor.findUnique({
    where: {
      userId,
    },
    // The account's authoritative contact details live on the user record.
    // Branding / prescription templates read them from here rather than
    // duplicating phone and email on the doctor profile.
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
    },
  });
};

const getDoctorProfileById = async (doctorId: string, workspaceId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) {
    throw createAppError("Doctor not found", Status.NOT_FOUND);
  }

  // BOLA/IDOR: only expose a doctor who is a member of the caller's workspace.
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: doctor.userId, workspaceId },
    },
    select: { id: true },
  });

  if (!membership) {
    throw createAppError("Doctor not found", Status.NOT_FOUND);
  }

  return doctor;
};

const getAllDoctors = async (workspaceId: string) => {
  // Scoped to doctors who are active members of the active workspace, never
  // the whole platform (Section 6.4).
  return await prisma.doctor.findMany({
    where: {
      user: {
        memberships: {
          some: { workspaceId, status: MembershipStatus.ACTIVE },
        },
      },
    },
  });
};

const getMyDoctors = async (workspaceId: string) => {
  // List doctors who are active members of the given workspace
  const memberships = await prisma.membership.findMany({
    where: {
      workspaceId,
      role: WorkspaceRole.DOCTOR,
      status: MembershipStatus.ACTIVE,
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          doctorProfile: {
            select: {
              id: true,
              name: true,
              bmdcNumber: true,
              specialization: true,
              qualifications: true,
              designation: true,
              verificationStatus: true,
            },
          },
        },
      },
    },
  });

  return memberships
    .map((m) => m.user)
    .filter((u) => u.doctorProfile)
    .map((u) => ({ ...u, doctor: u.doctorProfile }));
};

const updateDoctorProfile = async (
  data: IUpdateDoctorProfile,
  userId: string,
  workspaceId?: string,
) => {
  // Profile completion is allowed before professional verification (Section
  // 7.4): a pending doctor must be able to fill in their BMDC/qualifications
  // and signature in order to submit for verification.

  const { signatureUrl, registrationNo, qualification, designation } = data;

  // Map API field names to the Doctor model columns
  const doctorFields: Record<string, any> = {};
  if (data.name !== undefined) doctorFields.name = data.name;
  if (registrationNo !== undefined) doctorFields.bmdcNumber = registrationNo;
  if (qualification !== undefined) doctorFields.qualifications = qualification;
  if (data.specialization !== undefined)
    doctorFields.specialization = data.specialization;
  if (designation !== undefined) doctorFields.designation = designation;
  if (signatureUrl) doctorFields.signatureUrl = signatureUrl;
  if (data.prescriptionLanguage !== undefined)
    doctorFields.prescriptionLanguage = data.prescriptionLanguage;
  if (data.prescriptionTemplate !== undefined)
    doctorFields.prescriptionTemplate = data.prescriptionTemplate;

  // Get old values for audit logging
  const oldDoctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  const doctor = await prisma.$transaction(async (tx) => {
    // Delete old signature if a new one is provided
    if (signatureUrl) {
      const doctor = await tx.doctor.findUnique({
        where: { userId },
        select: { signatureUrl: true },
      });

      if (doctor?.signatureUrl) {
        deleteFileFromCloudinary(doctor.signatureUrl).catch(console.error);
      }
    }

    const updatedDoctor = await tx.doctor.update({
      where: { userId },
      data: doctorFields,
    });

    // Persist an uploaded profile image on the User record (avatar).
    if ((data as any).image) {
      await tx.user.update({
        where: { id: userId },
        data: { avatar: (data as any).image },
      });
    }

    return updatedDoctor;
  });

  // Audit: Log doctor profile update
  if (oldDoctor) {
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    Object.keys(doctorFields).forEach((key) => {
      if (key in oldDoctor) {
        oldValues[key] = (oldDoctor as any)[key];
      }
      newValues[key] = (doctor as any)[key];
    });

    if (signatureUrl) {
      oldValues.signatureUrl = oldDoctor.signatureUrl;
      newValues.signatureUrl = doctor.signatureUrl;
    }

    await AuditService.logAudit({
      userId,
      workspaceId,
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.USER,
      entityId: userId,
      oldValues,
      newValues,
      metadata: {
        doctorName: doctor.name,
      },
    });
  }

  return doctor;
};

export const DoctorServices = {
  assignDoctor,
  getDoctorProfile,
  getDoctorProfileById,
  getMyDoctors,
  updateDoctorProfile,
  getAllDoctors,
};
