import { Request, Response, NextFunction } from "express";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";
import { WorkspaceRole, SystemRole } from "../../generated/prisma/enums";
import { WorkspaceRequest } from "../interface/workspace.type";
import { workspaceService } from "../modules/workspace/workspace.service";
import { PermissionServices } from "../modules/permission/permission.service";




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


export const attachWorkspaceContext = (
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction,
) => {
  
  
  next();
};
