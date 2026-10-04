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


router.get("/", authOnly(), workspaceController.getUserWorkspaces);


router.post(
  "/",
  authOnly(),
  validateRequest(createWorkspaceSchema),
  workspaceController.createWorkspace,
);


router.get(
  "/invitations/pending",
  authOnly(),
  workspaceController.getPendingInvitations,
);



router.get("/invitations/:token", workspaceController.verifyInvitation);


router.post(
  "/invitations/accept",
  authOnly(),
  workspaceController.acceptInvitation,
);


router.post(
  "/invitations/reject",
  authOnly(),
  workspaceController.rejectInvitation,
);


router.patch(
  "/:workspaceId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  validateRequest(updateWorkspaceSchema),
  workspaceController.updateWorkspace,
);


router.delete(
  "/:workspaceId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  workspaceController.deleteWorkspace,
);


router.get(
  "/:workspaceId",
  authWorkspace([]) as any,
  workspaceController.getWorkspace,
);


router.get(
  "/:workspaceId/members",
  authWorkspace([]) as any,
  workspaceController.getWorkspaceMembers,
);


router.post(
  "/:workspaceId/members/invite",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  validateRequest(inviteUserSchema),
  workspaceController.inviteUser,
);


router.patch(
  "/:workspaceId/members/:memberId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("manage_roles"),
  validateRequest(updateMemberRoleSchema),
  workspaceController.updateMemberRole,
);


router.patch(
  "/:workspaceId/members/:memberId/suspend",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  workspaceController.suspendMember,
);


router.patch(
  "/:workspaceId/members/:memberId/restore",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  workspaceController.restoreMember,
);


router.delete(
  "/:workspaceId/members/:memberId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  workspaceController.removeMember,
);


router.get(
  "/:workspaceId/invitations",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  workspaceController.getWorkspaceInvitations,
);


router.delete(
  "/:workspaceId/invitations/:invitationId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  requireWorkspacePermission("invite_users"),
  workspaceController.cancelInvitation,
);

export default router;
