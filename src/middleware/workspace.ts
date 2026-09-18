import { Request, Response, NextFunction } from "express";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";
import { WorkspaceRole, SystemRole } from "../../generated/prisma/enums";
import { WorkspaceRequest } from "../interface/workspace.type";
import { workspaceService } from "../modules/workspace/workspace.service";
import { PermissionServices } from "../modules/permission/permission.service";

// `WorkspaceRequest` is defined in src/interface/workspace.type.ts

// Validate activeWorkspaceId from JWT is valid
export const requireWorkspace = async (
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId;
    const workspaceId = req.workspaceId;

    if (!userId || !workspaceId) {
      throw createAppError(
        "Missing workspace context. Please select a workspace.",
        Status.UNAUTHORIZED,
      );
    }

    // Verify user is member of workspace
    const isMember = await workspaceService.checkMembership(
      userId,
      workspaceId,
    );

    if (!isMember) {
      throw createAppError(
        "You do not have access to this workspace",
        Status.FORBIDDEN,
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Require specific workspace role(s)
export const requireWorkspaceRole = (...allowedRoles: WorkspaceRole[]) => {
  return (req: WorkspaceRequest, res: Response, next: NextFunction) => {
    if (!req.workspaceRole || !allowedRoles.includes(req.workspaceRole)) {
      throw createAppError(
        `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`,
        Status.FORBIDDEN,
      );
    }
    next();
  };
};

// Require specific permission (checks membership permissions JSON)
export const requirePermission = (permission: string) => {
  return (req: WorkspaceRequest, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(async () => {
        const userId = req.user?.id || req.userId;
        const workspaceRole = req.user?.workspaceRole as WorkspaceRole | undefined;
        const systemRole = req.user?.systemRole;

        if (!userId) {
          throw createAppError("Unauthorized", Status.UNAUTHORIZED);
        }

        // System admins bypass workspace-level permission checks
        if (systemRole === SystemRole.SUPER_ADMIN) {
          return;
        }

        if (!workspaceRole) {
          throw createAppError("Unauthorized", Status.UNAUTHORIZED);
        }

        const allowed = await PermissionServices.hasPermission(
          userId,
          workspaceRole,
          permission,
        );

        if (!allowed) {
          throw createAppError(
            `Permission denied: ${permission}`,
            Status.FORBIDDEN,
          );
        }
      })
      .then(() => next())
      .catch((error) => next(error));
  };
};

// Attach workspace context from JWT to request
export const attachWorkspaceContext = (
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction,
) => {
  // This will be populated by auth middleware from JWT
  // req.userId and req.workspaceId should already be set
  next();
};
