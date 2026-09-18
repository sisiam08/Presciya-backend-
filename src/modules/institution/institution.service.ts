import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  VerificationStatus,
  VerificationType,
} from "../../../generated/prisma/enums";
import { DepartmentServices } from "../department/department.service";

type InstitutionProfileInput = {
  name?: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  slogan?: string;
  logo?: string;
  description?: string;
  tradeLicenseNo?: string;
  registrationNumber?: string;
};

type BrandingInput = {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  headerTemplate?: string;
  footerTemplate?: string;
  showLogo?: boolean;
};

/**
 * The institution profile is spread across two tables:
 *  - `Institution` holds legal/registration data (name, tradeLicenseNo, website, description)
 *  - `Workspace` holds contact/location/branding-adjacent display data
 *    (address, phone, email, slogan, logo)
 * This helper maps a flat API payload onto both tables.
 */
const splitProfileData = (data: InstitutionProfileInput) => {
  const institutionData: Record<string, unknown> = {};
  const workspaceData: Record<string, unknown> = {};

  const name = data.legalName ?? data.name;
  if (name !== undefined) {
    institutionData.name = name;
    workspaceData.name = name;
  }

  const tradeLicenseNo = data.tradeLicenseNo ?? data.registrationNumber;
  if (tradeLicenseNo !== undefined) {
    institutionData.tradeLicenseNo = tradeLicenseNo;
  }

  if (data.website !== undefined) institutionData.website = data.website;
  if (data.description !== undefined)
    institutionData.description = data.description;

  if (data.address !== undefined) workspaceData.address = data.address;
  if (data.phone !== undefined) workspaceData.phone = data.phone;
  if (data.email !== undefined) workspaceData.email = data.email;
  if (data.slogan !== undefined) workspaceData.slogan = data.slogan;
  if (data.logo !== undefined) workspaceData.logo = data.logo;

  return { institutionData, workspaceData };
};

/**
 * Builds the flat profile shape the frontend consumes from the two records.
 */
const buildProfileResponse = (
  institution: Record<string, any>,
  workspace: Record<string, any> | null,
) => ({
  ...institution,
  legalName: institution.name,
  registrationNumber: institution.tradeLicenseNo,
  address: workspace?.address ?? null,
  phone: workspace?.phone ?? null,
  email: workspace?.email ?? null,
  slogan: workspace?.slogan ?? null,
  logo: workspace?.logo ?? null,
  workspaceId: workspace?.id ?? null,
});

const getWorkspaceOrThrow = async (workspaceId: string) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw createAppError("Workspace not found", Status.NOT_FOUND);
  }

  return workspace;
};

const createInstitution = async (
  workspaceId: string,
  data: InstitutionProfileInput & { name: string },
) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const existingInst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (existingInst) {
    throw createAppError(
      "Institution profile already exists for this user",
      Status.CONFLICT,
    );
  }

  const { institutionData, workspaceData } = splitProfileData(data);

  return await prisma.$transaction(async (tx) => {
    const institution = await tx.institution.create({
      data: {
        userId: workspace.ownerId,
        ...(institutionData as any),
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    if (Object.keys(workspaceData).length > 0) {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: workspaceData as any,
      });
    }

    return buildProfileResponse(institution, {
      ...workspace,
      ...workspaceData,
    });
  });
};

/**
 * Creates (or updates) the institution profile and ensures a verification
 * request exists. Institution accounts get a placeholder `Institution` row at
 * signup, so this endpoint must be idempotent rather than always creating.
 */
const createInstitutionWithVerification = async (
  workspaceId: string,
  data: InstitutionProfileInput & { name: string },
) => {
  return await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw createAppError("Workspace not found", Status.NOT_FOUND);
    }

    const existingInst = await tx.institution.findUnique({
      where: { userId: workspace.ownerId },
    });

    const { institutionData, workspaceData } = splitProfileData(data);

    const institution = existingInst
      ? await tx.institution.update({
          where: { userId: workspace.ownerId },
          data: institutionData as any,
        })
      : await tx.institution.create({
          data: {
            userId: workspace.ownerId,
            ...(institutionData as any),
            verificationStatus: VerificationStatus.PENDING,
          },
        });

    if (Object.keys(workspaceData).length > 0) {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: workspaceData as any,
      });
    }

    const existingRequest = await tx.verificationRequest.findFirst({
      where: { workspaceId, type: VerificationType.INSTITUTION },
      orderBy: { submittedAt: "desc" },
    });

    if (!existingRequest) {
      await tx.verificationRequest.create({
        data: {
          userId: institution.userId,
          workspaceId,
          type: VerificationType.INSTITUTION,
          status: VerificationStatus.PENDING,
          submittedData: {
            name: institution.name,
            email: data.email,
            tradeLicenseNo: institution.tradeLicenseNo,
          },
        },
      });
    }

    return buildProfileResponse(institution, {
      ...workspace,
      ...workspaceData,
    });
  });
};

const getInstitutionProfile = async (workspaceId: string) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
    include: {
      departments: true,
      subscriptions: true,
    },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  return buildProfileResponse(inst, workspace);
};

const updateInstitution = async (
  workspaceId: string,
  data: InstitutionProfileInput,
) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  const { institutionData, workspaceData } = splitProfileData(data);

  const updatedInstitution =
    Object.keys(institutionData).length > 0
      ? await prisma.institution.update({
          where: { userId: workspace.ownerId },
          data: institutionData as any,
        })
      : inst;

  const updatedWorkspace =
    Object.keys(workspaceData).length > 0
      ? await prisma.workspace.update({
          where: { id: workspaceId },
          data: workspaceData as any,
        })
      : workspace;

  return buildProfileResponse(updatedInstitution, updatedWorkspace);
};

/**
 * Persists the six documented branding fields (Section 10.1). These are the
 * only fields this endpoint writes — profile data such as description,
 * website or tradeLicense is updated via PATCH /institution/profile.
 */
const updateBranding = async (workspaceId: string, brandingConfig: BrandingInput) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  const dataToUpdate: Record<string, unknown> = {};
  if (brandingConfig.primaryColor !== undefined)
    dataToUpdate.primaryColor = brandingConfig.primaryColor;
  if (brandingConfig.secondaryColor !== undefined)
    dataToUpdate.secondaryColor = brandingConfig.secondaryColor;
  if (brandingConfig.fontFamily !== undefined)
    dataToUpdate.fontFamily = brandingConfig.fontFamily;
  if (brandingConfig.headerTemplate !== undefined)
    dataToUpdate.headerTemplate = brandingConfig.headerTemplate;
  if (brandingConfig.footerTemplate !== undefined)
    dataToUpdate.footerTemplate = brandingConfig.footerTemplate;
  if (brandingConfig.showLogo !== undefined)
    dataToUpdate.showLogo = brandingConfig.showLogo;

  const updated = await prisma.institution.update({
    where: { userId: workspace.ownerId },
    data: dataToUpdate as any,
  });

  return {
    primaryColor: updated.primaryColor,
    secondaryColor: updated.secondaryColor,
    fontFamily: updated.fontFamily,
    headerTemplate: updated.headerTemplate,
    footerTemplate: updated.footerTemplate,
    showLogo: updated.showLogo,
  };
};

const createDepartment = async (
  workspaceId: string,
  departmentData: { name: string; description?: string },
) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  // Single shared write path with the standalone /departments module.
  return await DepartmentServices.createDepartmentForInstitution(
    inst.id,
    departmentData,
  );
};

const getDepartments = async (workspaceId: string) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  return await DepartmentServices.listDepartmentsForInstitution(inst.id);
};

const assignDoctor = async (
  workspaceId: string,
  doctorData: {
    doctorId: string;
    departmentId?: string;
    chamberIds?: string[];
  },
) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorData.doctorId },
  });

  if (!doctor) {
    throw createAppError("Doctor not found", Status.NOT_FOUND);
  }

  return await prisma.$transaction(async (tx) => {
    const instDoctor = await tx.institutionDoctor.upsert({
      where: {
        institutionId_doctorId: {
          institutionId: inst.id,
          doctorId: doctor.id,
        },
      },
      update: {
        departmentId: doctorData.departmentId || null,
        isActive: true,
      },
      create: {
        institutionId: inst.id,
        doctorId: doctor.id,
        departmentId: doctorData.departmentId || null,
      },
    });

    if (doctorData.chamberIds && doctorData.chamberIds.length > 0) {
      await tx.doctorAssignment.deleteMany({
        where: { institutionDoctorId: instDoctor.id },
      });

      const assignments = doctorData.chamberIds.map((cId) => ({
        institutionDoctorId: instDoctor.id,
        chamberId: cId,
      }));

      await tx.doctorAssignment.createMany({
        data: assignments,
      });
    }

    return instDoctor;
  });
};

const removeDoctor = async (workspaceId: string, doctorId: string) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  await prisma.$transaction(async (tx) => {
    const instDoctor = await tx.institutionDoctor.findUnique({
      where: {
        institutionId_doctorId: {
          institutionId: inst.id,
          doctorId,
        },
      },
    });

    if (!instDoctor) {
      throw createAppError(
        "Doctor is not assigned to this institution",
        Status.NOT_FOUND,
      );
    }

    await tx.doctorAssignment.deleteMany({
      where: { institutionDoctorId: instDoctor.id },
    });

    await tx.institutionDoctor.delete({
      where: { id: instDoctor.id },
    });
  });
};

const getAssignedDoctors = async (workspaceId: string) => {
  const workspace = await getWorkspaceOrThrow(workspaceId);

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  return await prisma.institutionDoctor.findMany({
    where: { institutionId: inst.id, isActive: true },
    include: {
      department: true,
      doctor: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      },
      assignments: {
        include: {
          chamber: true,
        },
      },
    },
  });
};

export const InstitutionServices = {
  createInstitution,
  createInstitutionWithVerification,
  getInstitutionProfile,
  updateInstitution,
  updateBranding,
  createDepartment,
  getDepartments,
  assignDoctor,
  removeDoctor,
  getAssignedDoctors,
};
