import { Router } from "express";
import { workspaceController } from "./workspace.controller";
import { authOnly, authWorkspace } from "../../middleware/auth";
import validateRequest from "../../middleware/validateRequest";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteUserSchema,
  updateMemberRoleSchema,
} from "./workspace.validation";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { requirePermission as requireWorkspacePermission } from "../../middleware/workspace";

const router = Router();

// Get current user's workspaces
router.get("/", authOnly(), workspaceController.getUserWorkspaces);

// Create a new workspace
router.post(
  "/",
  authOnly(),
  validateRequest(createWorkspaceSchema),
  workspaceController.createWorkspace,
);

// Get pending invitations for current user
router.get(
  "/invitations/pending",
  authOnly(),
  workspaceController.getPendingInvitations,
);

// Accept invitation
router.post(
  "/invitations/accept",
  authOnly(),
  workspaceController.acceptInvitation,
);

// Reject invitation
router.post(
  "/invitations/reject",
  authOnly(),
  workspaceController.rejectInvitation,
);

// Update workspace (owner only)
router.patch(
  "/:workspaceId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  validateRequest(updateWorkspaceSchema),
  workspaceController.updateWorkspace,
);

// Delete workspace (owner only)
router.delete(
  "/:workspaceId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  workspaceController.deleteWorkspace,
);

// Get workspace detail
router.get(
  "/:workspaceId",
  authWorkspace([]) as any,
  workspaceController.getWorkspace,
);

// Get workspace members
router.get(
  "/:workspaceId/members",
  authWorkspace([]) as any,
  workspaceController.getWorkspaceMembers,
);

// Invite user to workspace
router.post(
  "/:workspaceId/members/invite",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  validateRequest(inviteUserSchema),
  workspaceController.inviteUser,
);

// Update member role
router.patch(
  "/:workspaceId/members/:memberId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("manage_roles"),
  validateRequest(updateMemberRoleSchema),
  workspaceController.updateMemberRole,
);

// Suspend membership (owner only)
router.patch(
  "/:workspaceId/members/:memberId/suspend",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  workspaceController.suspendMember,
);

// Restore membership (owner only)
router.patch(
  "/:workspaceId/members/:memberId/restore",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  workspaceController.restoreMember,
);

// Remove member from workspace
router.delete(
  "/:workspaceId/members/:memberId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  workspaceController.removeMember,
);

// Get sent invitations
router.get(
  "/:workspaceId/invitations",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  workspaceController.getWorkspaceInvitations,
);

// Cancel invitation
router.delete(
  "/:workspaceId/invitations/:invitationId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  workspaceController.cancelInvitation,
);

export default router;
