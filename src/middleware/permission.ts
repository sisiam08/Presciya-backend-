import { NextFunction, Request, Response } from "express";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";
import { PermissionServices } from "../modules/permission/permission.service";
import { WorkspaceRole, SystemRole } from "../../generated/prisma/enums";

export const requirePermission = (permissionKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const workspaceRole = req.user?.workspaceRole as
        | WorkspaceRole
        | undefined;
      const systemRole = req.user?.systemRole;

      if (!userId) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      // System admins bypass workspace-level permission checks
      if (systemRole === SystemRole.SUPER_ADMIN) {
        return next();
      }

      if (!workspaceRole) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      const allowed = await PermissionServices.hasPermission(
        userId,
        workspaceRole,
        permissionKey,
      );

      if (!allowed) {
        throw createAppError(
          `Permission denied: ${permissionKey}`,
          Status.FORBIDDEN,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
