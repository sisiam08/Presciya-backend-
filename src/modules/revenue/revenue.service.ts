import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  AuditActionType,
  AuditEntityType,
  MembershipStatus,
  WorkspaceType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";

const assertMembership = async (userId: string, workspaceId: string) => {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { status: true },
  });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw createAppError(
      "You do not have access to this workspace",
      Status.FORBIDDEN,
    );
  }
};

const assertInstitutionWorkspace = async (workspaceId: string) => {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true },
  });
  if (!ws || ws.type !== WorkspaceType.INSTITUTION) {
    throw createAppError(
      "Revenue sharing is only available for hospitals and clinics",
      Status.BAD_REQUEST,
    );
  }
};

const getConfig = async (userId: string, workspaceId: string) => {
  await assertMembership(userId, workspaceId);
  await assertInstitutionWorkspace(workspaceId);

  const configs = await prisma.revenueShareConfig.findMany({
    where: { workspaceId },
    include: { doctor: { select: { id: true, name: true } } },
  });

  const def = configs.find((c) => c.doctorId === null);
  const overrides = configs
    .filter((c) => c.doctorId !== null)
    .map((c) => ({
      doctorId: c.doctorId,
      doctorName: c.doctor?.name ?? "Doctor",
      percentage: Number(c.percentage),
    }));

  return {
    defaultPercentage: def ? Number(def.percentage) : 0,
    overrides,
  };
};

const setDefault = async (
  userId: string,
  workspaceId: string,
  pct: number,
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  await assertInstitutionWorkspace(workspaceId);

  const existing = await prisma.revenueShareConfig.findFirst({
    where: { workspaceId, doctorId: null },
  });

  const saved = existing
    ? await prisma.revenueShareConfig.update({
        where: { id: existing.id },
        data: { percentage: String(pct) },
      })
    : await prisma.revenueShareConfig.create({
        data: { workspaceId, doctorId: null, percentage: String(pct) },
      });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: existing ? AuditActionType.UPDATE : AuditActionType.CREATE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: saved.id,
    oldValues: existing ? { percentage: Number(existing.percentage) } : null,
    newValues: { percentage: pct },
    metadata: { setting: "revenue_share_default" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { defaultPercentage: Number(saved.percentage) };
};

const setOverride = async (
  userId: string,
  workspaceId: string,
  doctorId: string,
  pct: number,
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  await assertInstitutionWorkspace(workspaceId);

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true },
  });
  if (!doctor) {
    throw createAppError("Doctor not found", Status.NOT_FOUND);
  }

  const existing = await prisma.revenueShareConfig.findUnique({
    where: { workspaceId_doctorId: { workspaceId, doctorId } },
  });

  const saved = await prisma.revenueShareConfig.upsert({
    where: { workspaceId_doctorId: { workspaceId, doctorId } },
    update: { percentage: String(pct) },
    create: { workspaceId, doctorId, percentage: String(pct) },
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: existing ? AuditActionType.UPDATE : AuditActionType.CREATE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: saved.id,
    oldValues: existing ? { percentage: Number(existing.percentage) } : null,
    newValues: { doctorId, percentage: pct },
    metadata: { setting: "revenue_share_override" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { doctorId, percentage: Number(saved.percentage) };
};

const removeOverride = async (
  userId: string,
  workspaceId: string,
  doctorId: string,
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  await assertInstitutionWorkspace(workspaceId);

  const existing = await prisma.revenueShareConfig.findUnique({
    where: { workspaceId_doctorId: { workspaceId, doctorId } },
  });
  if (!existing) {
    throw createAppError("Override not found", Status.NOT_FOUND);
  }

  await prisma.revenueShareConfig.delete({ where: { id: existing.id } });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.WORKSPACE,
    entityId: existing.id,
    oldValues: { doctorId, percentage: Number(existing.percentage) },
    metadata: { setting: "revenue_share_override_removed" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
};

/** Effective percentage for a doctor: override → workspace default → 0. */
const resolveSharePercent = async (
  workspaceId: string,
  doctorId: string,
): Promise<number> => {
  const override = await prisma.revenueShareConfig.findUnique({
    where: { workspaceId_doctorId: { workspaceId, doctorId } },
  });
  if (override) return Number(override.percentage);

  const def = await prisma.revenueShareConfig.findFirst({
    where: { workspaceId, doctorId: null },
  });
  return def ? Number(def.percentage) : 0;
};

export const RevenueServices = {
  getConfig,
  setDefault,
  setOverride,
  removeOverride,
  resolveSharePercent,
};
