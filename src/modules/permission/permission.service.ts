import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const hasPermission = async (
  userId: string,
  workspaceRole: WorkspaceRole,
  permissionKey: string,
): Promise<boolean> => {
  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { id: true },
  });

  if (!permission) {
    throw createAppError("Permission not found", Status.NOT_FOUND);
  }

  const [rolePermission, userPermission] = await Promise.all([
    prisma.rolePermission.findUnique({
      where: {
        role_permissionId: { role: workspaceRole, permissionId: permission.id },
      },
      select: { permissionId: true },
    }),
    prisma.userPermission.findUnique({
      where: {
        userId_permissionId: { userId, permissionId: permission.id },
      },
      select: { permissionId: true },
    }),
  ]);

  return Boolean(rolePermission || userPermission);
};

export const PermissionServices = {
  hasPermission,
};
