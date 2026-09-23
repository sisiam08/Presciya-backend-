import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  WorkspaceType,
  WorkspaceRole,
  MembershipStatus,
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import {
  ICreateWorkspaceDTO,
  IWorkspaceResponseDTO,
  IWorkspaceDetailDTO,
} from "../../interface/workspace.type";
import { checkUserVerification } from "../../utils/verificationCheck";
import { FeatureServices } from "../feature/feature.service";
import {
  TemplateConfigLike,
  hasFooterConfig,
  hasWatermarkConfig,
} from "../../utils/branding";

// Generate URL-friendly slug
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Create personal workspace during signup
const createPersonalWorkspace = async (
  userId: string,
  doctorName: string,
): Promise<IWorkspaceResponseDTO> => {
  const slug = generateSlug(doctorName);

  const workspace = (await prisma.workspace.create({
    data: {
      name: `${doctorName}'s Practice`,
      slug: slug,
      type: WorkspaceType.PERSONAL,
      ownerId: userId,
      memberships: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      logo: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as any;

  // Audit: Log workspace creation
  await AuditService.logAudit({
    userId,
    workspaceId: workspace.id,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: workspace.id,
    newValues: {
      name: workspace.name,
      type: WorkspaceType.PERSONAL,
      ownerId: userId,
    },
    metadata: {
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    },
  });

  return workspace;
};

// Create institution workspace during signup
const createInstitutionWorkspace = async (
  userId: string,
  institutionName: string,
): Promise<IWorkspaceResponseDTO> => {
  const slug = generateSlug(institutionName);

  const workspace = (await prisma.workspace.create({
    data: {
      name: institutionName,
      slug: slug,
      type: WorkspaceType.INSTITUTION,
      ownerId: userId,
      memberships: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      logo: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as any;

  // Audit: Log workspace creation
  await AuditService.logAudit({
    userId,
    workspaceId: workspace.id,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: workspace.id,
    newValues: {
      name: workspace.name,
      type: WorkspaceType.INSTITUTION,
      ownerId: userId,
    },
    metadata: {
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    },
  });

  return workspace;
};

// Create a new workspace (any verified user can create)
const createWorkspace = async (
  userId: string,
  name: string,
  type: WorkspaceType,
  image?: string,
): Promise<IWorkspaceResponseDTO> => {
  await checkUserVerification(userId);

  const slug = generateSlug(name);

  const existingSlug = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existingSlug) {
    throw createAppError(
      "Workspace name already in use. Please choose a different name.",
      Status.CONFLICT,
    );
  }

  const workspace = (await prisma.workspace.create({
    data: {
      name,
      slug,
      type,
      ownerId: userId,
      ...(image ? { logo: image } : {}),
      memberships: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      logo: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as any;

  // Audit: Log workspace creation
  await AuditService.logAudit({
    userId,
    workspaceId: workspace.id,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: workspace.id,
    newValues: {
      name: workspace.name,
      type,
      ownerId: userId,
    },
    metadata: {
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    },
  });

  return workspace;
};

// Update workspace (owner only)
const updateWorkspace = async (
  workspaceId: string,
  userId: string,
  data: {
    name?: string;
    logo?: string;
    slogan?: string | null;
    /** Personal-prescription settings: { footerText, watermarkEnabled, ... }. */
    templateConfig?: Record<string, unknown> | null;
  },
): Promise<IWorkspaceResponseDTO> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true, name: true, logo: true },
  });

  if (!workspace) {
    throw createAppError("Workspace not found", Status.NOT_FOUND);
  }

  if (workspace.ownerId !== userId) {
    throw createAppError(
      "Only the workspace owner can update the workspace",
      Status.FORBIDDEN,
    );
  }

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) {
    const slug = generateSlug(data.name);
    const slugTaken = await prisma.workspace.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (slugTaken && slugTaken.id !== workspaceId) {
      throw createAppError(
        "Workspace name already in use. Please choose a different name.",
        Status.CONFLICT,
      );
    }
    updateData.name = data.name;
    updateData.slug = slug;
  }
  if (data.logo !== undefined) updateData.logo = data.logo;
  if (data.slogan !== undefined) updateData.slogan = data.slogan;

  // Personal-prescription settings are premium, admin-configurable features.
  // Footer text and watermark are SEPARATE entitlements, and each is only
  // enforced when the payload actually writes that part — so saving unrelated
  // settings never fails with a late entitlement error.
  if (data.templateConfig !== undefined) {
    const config = data.templateConfig as TemplateConfigLike | null;

    if (hasFooterConfig(config)) {
      await FeatureServices.checkFeatureAccess({
        featureKey: "custom_branding",
        userId,
        workspaceId,
        trackUsage: false,
        incrementBy: 0,
      });
    }

    if (hasWatermarkConfig(config)) {
      await FeatureServices.checkFeatureAccess({
        featureKey: "watermark",
        userId,
        workspaceId,
        trackUsage: false,
        incrementBy: 0,
      });
    }

    updateData.templateConfig = data.templateConfig;
  }

  const updated = (await prisma.workspace.update({
    where: { id: workspaceId },
    data: updateData,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      logo: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as any;

  // Audit: Log workspace update
  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: workspaceId,
    oldValues: { name: workspace.name, logo: workspace.logo },
    newValues: {
      ...(updateData.name ? { name: updateData.name } : {}),
      ...(updateData.logo ? { logo: updateData.logo } : {}),
    },
  });

  return updated;
};

// Delete workspace (owner only). Only allowed when workspace has no
// prescriptions, chambers, or patients (otherwise archiving is required).
const deleteWorkspace = async (
  workspaceId: string,
  userId: string,
): Promise<void> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (!workspace) {
    throw createAppError("Workspace not found", Status.NOT_FOUND);
  }

  if (workspace.ownerId !== userId) {
    throw createAppError(
      "Only the workspace owner can delete the workspace",
      Status.FORBIDDEN,
    );
  }

  const [prescriptions, chambers, patients] = await Promise.all([
    prisma.prescription.count({ where: { workspaceId } }),
    prisma.chamber.count({ where: { workspaceId } }),
    prisma.patient.count({ where: { workspaceId } }),
  ]);

  if (prescriptions > 0 || chambers > 0 || patients > 0) {
    throw createAppError(
      "Cannot delete a workspace that has prescriptions, chambers, or patients. Archive or remove them first.",
      Status.BAD_REQUEST,
    );
  }

  await prisma.$transaction([
    prisma.usageTracking.deleteMany({ where: { workspaceId } }),
    prisma.invitation.deleteMany({ where: { workspaceId } }),
    prisma.subscription.deleteMany({ where: { workspaceId } }),
    prisma.membership.deleteMany({ where: { workspaceId } }),
    prisma.workspace.delete({ where: { id: workspaceId } }),
  ]);

  // Audit: Log workspace deletion
  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: workspaceId,
    oldValues: { id: workspaceId },
    metadata: {
      workspaceDeleted: true,
    },
  });
};

// Get workspace detail
const getWorkspace = async (
  workspaceId: string,
  userId?: string,
): Promise<IWorkspaceDetailDTO> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: {
        select: { id: true, name: true, email: true, avatar: true },
      },
      memberships: {
        select: { id: true },
      },
    },
  });

  if (!workspace) {
    throw createAppError("Workspace not found", Status.NOT_FOUND);
  }

  // Report the caller's real role, never a hardcoded OWNER.
  let callerRole: WorkspaceRole = WorkspaceRole.OWNER;
  if (userId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    if (!membership) {
      throw createAppError(
        "You do not have access to this workspace",
        Status.FORBIDDEN,
      );
    }
    callerRole = membership.role;
  }

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    type: workspace.type,
    ...(workspace.logo ? { logo: workspace.logo } : {}),
    ownerId: workspace.ownerId,
    role: callerRole,
    members: ((workspace.memberships as any) || []).length,
    owner: {
      id: workspace.owner.id,
      name: workspace.owner.name,
      email: workspace.owner.email,
      ...(workspace.owner.avatar ? { avatar: workspace.owner.avatar } : {}),
    },
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
};

// Get all user workspaces
const getUserWorkspaces = async (userId: string): Promise<any[]> => {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      // Only ACTIVE memberships are selectable (Section 5.3).
      status: MembershipStatus.ACTIVE,
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          logo: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
    memberId: m.id,
  }));
};

// Get workspace members
const getWorkspaceMembers = async (workspaceId: string): Promise<any[]> => {
  return await prisma.membership.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
};

// Update member role
const updateMemberRole = async (
  workspaceId: string,
  memberId: string,
  newRole: WorkspaceRole,
  updatedByUserId?: string,
): Promise<any> => {
  // Check if the user performing the action is verified
  if (updatedByUserId) {
    await checkUserVerification(updatedByUserId);
  }

  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    throw createAppError("Member not found in workspace", Status.NOT_FOUND);
  }

  if (
    membership.role === WorkspaceRole.OWNER &&
    newRole !== WorkspaceRole.OWNER
  ) {
    throw createAppError(
      "Cannot remove owner role. Transfer ownership first.",
      Status.BAD_REQUEST,
    );
  }

  const updated = await prisma.membership.update({
    where: { id: memberId },
    data: { role: newRole },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });

  // Audit: Log role change
  await AuditService.logAudit({
    userId: updatedByUserId,
    workspaceId,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.MEMBERSHIP,
    entityId: memberId,
    oldValues: {
      role: membership.role,
    },
    newValues: {
      role: newRole,
    },
    metadata: {
      memberName: updated.user.name,
      memberEmail: updated.user.email,
    },
  });

  return updated;
};

// Remove member
const removeMember = async (
  workspaceId: string,
  memberId: string,
  removedByUserId?: string,
): Promise<void> => {
  // Check if the user performing the action is verified
  if (removedByUserId) {
    await checkUserVerification(removedByUserId);
  }

  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    throw createAppError("Member not found in workspace", Status.NOT_FOUND);
  }

  if (membership.role === WorkspaceRole.OWNER) {
    throw createAppError(
      "Cannot remove workspace owner. Transfer ownership first.",
      Status.BAD_REQUEST,
    );
  }

  await prisma.membership.delete({ where: { id: memberId } });

  // Audit: Log member removal
  await AuditService.logAudit({
    userId: removedByUserId,
    workspaceId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.MEMBERSHIP,
    entityId: memberId,
    oldValues: {
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    },
    metadata: {
      removedMemberName: membership.user.name,
      removedMemberEmail: membership.user.email,
    },
  });
};

// Suspend or restore membership status
const updateMembershipStatus = async (
  workspaceId: string,
  memberId: string,
  status: MembershipStatus,
  updatedByUserId?: string,
): Promise<any> => {
  if (updatedByUserId) {
    await checkUserVerification(updatedByUserId);
  }

  const membership = await prisma.membership.findUnique({
    where: { id: memberId },
  });

  if (!membership || membership.workspaceId !== workspaceId) {
    throw createAppError("Member not found in workspace", Status.NOT_FOUND);
  }

  if (membership.role === WorkspaceRole.OWNER) {
    throw createAppError(
      "Cannot suspend or restore the workspace owner",
      Status.BAD_REQUEST,
    );
  }

  if (membership.status === status) {
    throw createAppError(
      `Member is already ${status.toLowerCase()}`,
      Status.BAD_REQUEST,
    );
  }

  const updated = await prisma.membership.update({
    where: { id: memberId },
    data: { status },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });

  const actionType =
    status === MembershipStatus.SUSPENDED
      ? AuditActionType.SUSPEND
      : AuditActionType.RESTORE;

  // Audit: Log membership status change
  await AuditService.logAudit({
    userId: updatedByUserId,
    workspaceId,
    actionType,
    entityType: AuditEntityType.MEMBERSHIP,
    entityId: memberId,
    oldValues: { status: membership.status },
    newValues: { status },
    metadata: {
      memberName: updated.user.name,
      memberEmail: updated.user.email,
    },
  });

  return updated;
};

// Check membership exists and is active
const checkMembership = async (
  userId: string,
  workspaceId: string,
): Promise<boolean> => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  });

  return membership != null;
};

export const workspaceService = {
  createPersonalWorkspace,
  createInstitutionWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspace,
  getUserWorkspaces,
  getWorkspaceMembers,
  updateMemberRole,
  updateMembershipStatus,
  removeMember,
  checkMembership,
};
