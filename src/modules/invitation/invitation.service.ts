import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  WorkspaceRole,
  MembershipStatus,
  AuditActionType,
  AuditEntityType,
  NotificationType,
} from "../../../generated/prisma/enums";
import { sendInvitationEmail } from "../../utils/emailService";
import { AuditService } from "../audit/audit.service";
import { NotificationServices } from "../notification/notification.service";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import config from "../../config";

const INVITATION_EXPIRY_DAYS = config.invitationExpiryDays;

// Generate secure random token
const generateToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

const inviteUser = async (
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedByUserId: string,
  userName: string,
  dummyPassword?: string,
  departmentId?: string,
): Promise<any> => {
  const workspaceInfo = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });

  if (!workspaceInfo) {
    throw createAppError("Workspace not found", Status.NOT_FOUND);
  }

  let existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  let isNewUser = false;

  if (!existingUser) {
    if (!dummyPassword) {
      throw createAppError(
        "Dummy password required to invite new user.",
        Status.BAD_REQUEST,
      );
    }

    isNewUser = true;
    const hashedPassword = await bcrypt.hash(dummyPassword, 10);

    existingUser = await prisma.user.create({
      data: {
        name: userName,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  if (departmentId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw createAppError("Workspace not found", Status.NOT_FOUND);
    }

    const institution = await prisma.institution.findUnique({
      where: { userId: workspace.ownerId },
      select: { id: true },
    });

    if (!institution) {
      throw createAppError("Institution not found", Status.NOT_FOUND);
    }

    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        institutionId: institution.id,
      },
      select: { id: true },
    });

    if (!department) {
      throw createAppError(
        "Department not found in this institution",
        Status.NOT_FOUND,
      );
    }
  }

  // Check if user already has a membership in this workspace
  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: existingUser.id,
        workspaceId,
      },
    },
  });

  if (existingMembership) {
    if (existingMembership.status === MembershipStatus.ACTIVE) {
      throw createAppError(
        `User is already a member of "${workspaceInfo.name}" in ${existingMembership.role} role.`,
        Status.CONFLICT,
      );
    } else if (existingMembership.status === MembershipStatus.PENDING) {
      throw createAppError(
        `User has already been invited to "${workspaceInfo.name}" as ${existingMembership.role}. Invitation is pending acceptance.`,
        Status.CONFLICT,
      );
    }
  }

  await prisma.membership.create({
    data: {
      userId: existingUser.id,
      workspaceId,
      role,
      status: MembershipStatus.PENDING,
    },
  });

  const invitation = await prisma.invitation.create({
    data: {
      email,
      workspaceId,
      role,
      departmentId: departmentId ?? null,
      token,
      expiresAt,
      invitedById: invitedByUserId,
    },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  // Send invitation email with optional credentials
  try {
    await sendInvitationEmail(
      email,
      existingUser.name,
      workspaceInfo.name,
      token,
      isNewUser ? dummyPassword : undefined,
      isNewUser,
    );
  } catch (err) {
    console.error("Failed to send invitation email:", err);
    await prisma.invitation.delete({
      where: { id: invitation.id },
    });
    throw createAppError(
      "Failed to send invitation email. Please try again.",
      Status.INTERNAL_SERVER_ERROR,
    );
  }

  // Audit: Log invitation sent
  await AuditService.logAudit({
    userId: invitedByUserId,
    workspaceId,
    actionType: AuditActionType.INVITE,
    entityType: AuditEntityType.INVITATION,
    entityId: invitation.id,
    newValues: {
      email,
      role,
      status: MembershipStatus.PENDING,
      expiresAt,
    },
    metadata: {
      invitedUserName: existingUser.name,
      isNewUser,
      workspaceName: workspaceInfo.name,
    },
  });

  // Notify the invitee in-app
  try {
    await NotificationServices.createNotification({
      userId: existingUser.id,
      title: "New workspace invitation",
      message: `You have been invited to join "${workspaceInfo.name}" as ${role}.`,
      type: NotificationType.INVITATION,
    });
  } catch (err) {
    console.error("Failed to create invitation notification:", err);
  }

  return {
    user: existingUser,
  };
};

const acceptInvitation = async (
  token: string,
  userId?: string,
): Promise<any> => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      workspaceId: true,
      invitedById: true,
      departmentId: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      rejectedAt: true,
    },
  });

  if (!invitation) {
    throw createAppError("Invalid invitation", Status.NOT_FOUND);
  }

  if (invitation.acceptedAt) {
    throw createAppError("Invitation already accepted", Status.BAD_REQUEST);
  }

  if (invitation.rejectedAt) {
    throw createAppError("Invitation was rejected", Status.BAD_REQUEST);
  }

  if (new Date() > invitation.expiresAt) {
    throw createAppError("Invitation has expired", Status.BAD_REQUEST);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { id: true, name: true, email: true },
  });

  if (!user || user.email !== invitation.email) {
    throw createAppError(
      "Invitation email does not match your account email.",
      Status.FORBIDDEN,
    );
  }

  const membership = await prisma.$transaction(async (tx) => {
    const updated = await tx.membership.update({
      where: {
        userId_workspaceId: {
          userId: userId!,
          workspaceId: invitation.workspaceId,
        },
      },
      data: {
        status: MembershipStatus.ACTIVE,
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (invitation.role === "DOCTOR") {
      const workspace = await tx.workspace.findUnique({
        where: { id: invitation.workspaceId },
        select: { ownerId: true },
      });

      if (workspace) {
        const institution = await tx.institution.findUnique({
          where: { userId: workspace.ownerId },
          select: { id: true },
        });

        const doctor = await tx.doctor.findUnique({
          where: { userId: userId! },
          select: { id: true },
        });

        if (institution && doctor) {
          await tx.institutionDoctor.create({
            data: {
              institutionId: institution.id,
              doctorId: doctor.id,
              ...(invitation.departmentId
                ? { departmentId: invitation.departmentId }
                : {}),
            },
          });
        }
      }
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return updated;
  });

  // Audit: Log invitation acceptance
  await AuditService.logAudit({
    userId,
    workspaceId: invitation.workspaceId,
    actionType: AuditActionType.ACCEPT,
    entityType: AuditEntityType.INVITATION,
    entityId: invitation.id,
    oldValues: {
      status: MembershipStatus.PENDING,
    },
    newValues: {
      status: MembershipStatus.ACTIVE,
      acceptedAt: new Date(),
    },
    metadata: {
      userEmail: invitation.email,
      role: invitation.role,
      workspaceName: membership.workspace.name,
    },
  });

  // Notify the inviter in-app
  if (invitation.invitedById) {
    try {
      await NotificationServices.createNotification({
        userId: invitation.invitedById,
        title: "Invitation accepted",
        message: `${user.name} accepted the invitation to join "${membership.workspace.name}".`,
        type: NotificationType.INVITATION,
      });
    } catch (err) {
      console.error("Failed to create invitation notification:", err);
    }
  }

  return membership;
};

// Reject invitation
const rejectInvitation = async (
  token: string,
  userId?: string,
): Promise<void> => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    throw createAppError("Invalid invitation", Status.NOT_FOUND);
  }

  if (invitation.acceptedAt) {
    throw createAppError("Invitation already accepted", Status.BAD_REQUEST);
  }

  if (invitation.rejectedAt) {
    throw createAppError("Invitation already rejected", Status.BAD_REQUEST);
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { rejectedAt: new Date() },
  });

  // Audit: Log invitation rejection
  await AuditService.logAudit({
    userId,
    workspaceId: invitation.workspaceId,
    actionType: AuditActionType.REJECT,
    entityType: AuditEntityType.INVITATION,
    entityId: invitation.id,
    newValues: {
      rejectedAt: new Date(),
    },
    metadata: {
      userEmail: invitation.email,
      role: invitation.role,
    },
  });

  // Notify the inviter in-app
  if (invitation.invitedById) {
    try {
      await NotificationServices.createNotification({
        userId: invitation.invitedById,
        title: "Invitation rejected",
        message: `${invitation.email} declined the invitation to join the workspace.`,
        type: NotificationType.INVITATION,
      });
    } catch (err) {
      console.error("Failed to create invitation notification:", err);
    }
  }
};

// Get pending invitations for user
const getPendingInvitations = async (email: string): Promise<any[]> => {
  return await prisma.invitation.findMany({
    where: {
      email,
      acceptedAt: null,
      rejectedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, type: true },
      },
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

// Get invitations sent by workspace admin
const getWorkspaceInvitations = async (workspaceId: string): Promise<any[]> => {
  return await prisma.invitation.findMany({
    where: { workspaceId },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

// Cancel invitation (by sender)
const cancelInvitation = async (
  invitationId: string,
  workspaceId: string,
  cancelledByUserId?: string,
): Promise<void> => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation || invitation.workspaceId !== workspaceId) {
    throw createAppError("Invitation not found", Status.NOT_FOUND);
  }

  if (invitation.acceptedAt) {
    throw createAppError(
      "Cannot cancel accepted invitation",
      Status.BAD_REQUEST,
    );
  }

  await prisma.invitation.delete({
    where: { id: invitationId },
  });

  // Audit: Log invitation cancellation
  await AuditService.logAudit({
    userId: cancelledByUserId,
    workspaceId,
    actionType: AuditActionType.CANCEL,
    entityType: AuditEntityType.INVITATION,
    entityId: invitationId,
    oldValues: {
      email: invitation.email,
      role: invitation.role,
      status: MembershipStatus.PENDING,
    },
    metadata: {
      cancelledReason: "Invitation cancelled by sender",
    },
  });
};

// Verify invitation token exists and is valid
const verifyInvitationToken = async (token: string): Promise<any> => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, type: true },
      },
    },
  });

  if (!invitation) {
    throw createAppError("Invalid invitation", Status.NOT_FOUND);
  }

  if (invitation.acceptedAt) {
    throw createAppError("Invitation already accepted", Status.BAD_REQUEST);
  }

  if (invitation.rejectedAt) {
    throw createAppError("Invitation was rejected", Status.BAD_REQUEST);
  }

  if (new Date() > invitation.expiresAt) {
    throw createAppError("Invitation has expired", Status.BAD_REQUEST);
  }

  return invitation;
};

export const invitationService = {
  inviteUser,
  acceptInvitation,
  rejectInvitation,
  getPendingInvitations,
  getWorkspaceInvitations,
  cancelInvitation,
  verifyInvitationToken,
};
