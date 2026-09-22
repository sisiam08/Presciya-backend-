import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { invitationService } from "../invitation/invitation.service";
import { AuthenticatedRequest } from "../../middleware/auth";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { workspaceService } from "./workspace.service";
import { FeatureServices } from "../feature/feature.service";
import { WorkspaceType, MembershipStatus } from "../../../generated/prisma/enums";

// Create a workspace
const createWorkspace = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const { name, image, type } = req.body;

    // Institution workspaces are not part of the current public release.
    if (type === WorkspaceType.INSTITUTION) {
      await FeatureServices.assertInstitutionEnabled();
    }

    const workspace = await workspaceService.createWorkspace(
      userId,
      name,
      type === WorkspaceType.INSTITUTION
        ? WorkspaceType.INSTITUTION
        : WorkspaceType.PERSONAL,
      image,
    );

    res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      data: workspace,
    });
  },
);

// Update workspace (owner only)
const updateWorkspace = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const workspaceId = req.params.workspaceId as string;
    const { name, image, slogan, templateConfig } = req.body;

    const workspace = await workspaceService.updateWorkspace(
      workspaceId,
      userId,
      { name, logo: image, slogan, templateConfig },
    );

    res.json({
      success: true,
      message: "Workspace updated successfully",
      data: workspace,
    });
  },
);

// Delete workspace (owner only)
const deleteWorkspace = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const workspaceId = req.params.workspaceId as string;

    await workspaceService.deleteWorkspace(workspaceId, userId);

    res.json({
      success: true,
      message: "Workspace deleted successfully",
    });
  },
);

// Suspend membership
const suspendMember = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const workspaceId = req.params.workspaceId as string;
    const memberId = req.params.memberId as string;

    const member = await workspaceService.updateMembershipStatus(
      workspaceId,
      memberId,
      MembershipStatus.SUSPENDED,
      userId,
    );

    res.json({
      success: true,
      message: "Member suspended successfully",
      data: member,
    });
  },
);

// Restore membership
const restoreMember = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const workspaceId = req.params.workspaceId as string;
    const memberId = req.params.memberId as string;

    const member = await workspaceService.updateMembershipStatus(
      workspaceId,
      memberId,
      MembershipStatus.ACTIVE,
      userId,
    );

    res.json({
      success: true,
      message: "Member restored successfully",
      data: member,
    });
  },
);

// Get all user workspaces
const getUserWorkspaces = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const workspaces = await workspaceService.getUserWorkspaces(userId);
    res.json({
      success: true,
      data: workspaces,
    });
  },
);

// Get workspace detail
const getWorkspace = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const workspace = await workspaceService.getWorkspace(
      workspaceId,
      req.user?.id,
    );
    res.json({
      success: true,
      data: workspace,
    });
  },
);

// Get workspace members
const getWorkspaceMembers = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const members = await workspaceService.getWorkspaceMembers(workspaceId);
    res.json({
      success: true,
      data: members,
    });
  },
);

// Invite user to workspace
const inviteUser = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const { email, role, name, departmentId } = req.body;
    const invitedByUserId = req.user?.id;

    if (!invitedByUserId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const invitation = await invitationService.inviteUser(
      workspaceId,
      email,
      role,
      invitedByUserId,
      name,
      undefined,
      departmentId,
    );

    res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      data: invitation,
    });
  },
);

// Update member role
const updateMemberRole = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const memberId = req.params.memberId as string;
    const { role } = req.body;
    const userId = req.user?.id;

    const member = await workspaceService.updateMemberRole(
      workspaceId,
      memberId,
      role,
      userId,
    );

    res.json({
      success: true,
      message: "Member role updated successfully",
      data: member,
    });
  },
);

// Remove member from workspace
const removeMember = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const memberId = req.params.memberId as string;
    const userId = req.user?.id;

    await workspaceService.removeMember(workspaceId, memberId, userId);

    res.json({
      success: true,
      message: "Member removed from workspace",
    });
  },
);

// Get pending invitations for current user
const getPendingInvitations = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const email = req.user?.email;

    if (!email) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const invitations = await invitationService.getPendingInvitations(email);

    res.json({
      success: true,
      data: invitations,
    });
  },
);

// Accept invitation
const acceptInvitation = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw createAppError("Unauthorized", Status.UNAUTHORIZED);
    }

    const membership = await invitationService.acceptInvitation(token, userId);

    res.json({
      success: true,
      message: "Invitation accepted successfully",
      data: membership,
    });
  },
);

// Reject invitation
const rejectInvitation = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;
    const userId = req.user?.id;

    await invitationService.rejectInvitation(token, userId);

    res.json({
      success: true,
      message: "Invitation rejected",
    });
  },
);

// Get workspace invitations (sent from this workspace)
const getWorkspaceInvitations = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;

    const invitations =
      await invitationService.getWorkspaceInvitations(workspaceId);

    res.json({
      success: true,
      data: invitations,
    });
  },
);

// Cancel invitation
const cancelInvitation = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.params.workspaceId as string;
    const invitationId = req.params.invitationId as string;
    const userId = req.user?.id;

    await invitationService.cancelInvitation(invitationId, workspaceId, userId);

    res.json({
      success: true,
      message: "Invitation cancelled",
    });
  },
);

// Verify an invitation token (public). Lets the accept page show the workspace
// details before the invitee logs in / accepts. Only non-sensitive fields are
// returned — never the full invitation record.
const verifyInvitation = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const token = req.params.token as string;
    const invitation = await invitationService.verifyInvitationToken(token);

    res.json({
      success: true,
      data: {
        workspaceName: invitation.workspace?.name ?? null,
        workspaceType: invitation.workspace?.type ?? null,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
    });
  },
);

export const workspaceController = {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  suspendMember,
  restoreMember,
  getUserWorkspaces,
  getWorkspace,
  getWorkspaceMembers,
  inviteUser,
  updateMemberRole,
  removeMember,
  getPendingInvitations,
  acceptInvitation,
  rejectInvitation,
  getWorkspaceInvitations,
  cancelInvitation,
  verifyInvitation,
};
