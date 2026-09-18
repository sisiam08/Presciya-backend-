import {
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

interface AuditLogParams {
  userId?: string | undefined | null;
  workspaceId?: string | undefined | null;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId?: string | undefined | null;
  oldValues?: Record<string, any> | undefined | null;
  newValues?: Record<string, any> | undefined | null;
  metadata?: Record<string, any> | undefined | null;
  ipAddress?: string | undefined | null;
  userAgent?: string | undefined | null;
}

/**
 * Log audit events for all important actions in the system
 * Captures: CREATE, UPDATE, DELETE, LOGIN, PASSWORD_CHANGE, INVITE, ACCEPT, REJECT, etc.
 */
const logAudit = async (params: AuditLogParams): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        workspaceId: params.workspaceId ?? null,
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldValues: params.oldValues
          ? (JSON.stringify(params.oldValues) as any)
          : null,
        newValues: params.newValues
          ? (JSON.stringify(params.newValues) as any)
          : null,
        metadata: params.metadata
          ? (JSON.stringify(params.metadata) as any)
          : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("❌ AuditLog writing failed:", error);
    // Don't throw - audit logging failures shouldn't break the main operation
  }
};

/**
 * Helper to extract values for audit comparison
 */
const extractAuditValues = (obj: any, fields: string[]) => {
  const result: Record<string, any> = {};
  fields.forEach((field) => {
    if (obj && field in obj) {
      result[field] = obj[field];
    }
  });
  return result;
};

export const AuditService = {
  logAudit,
  extractAuditValues,
};
