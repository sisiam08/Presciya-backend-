import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  AuditActionType,
  AuditEntityType,
  MembershipStatus,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";

const getDoctorForUser = async (userId: string) => {
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }
  return doctor;
};

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

const serialize = (fee: any) =>
  fee
    ? {
        ...fee,
        visitingFee: Number(fee.visitingFee),
        followUpFee: fee.followUpFee === null ? null : Number(fee.followUpFee),
      }
    : null;

/**
 * The doctor — and only the doctor — sets their own consultation fee for a
 * workspace. A hospital/clinic can never change this value.
 */
const upsertMyFee = async (
  userId: string,
  workspaceId: string,
  data: { visitingFee: string | number; followUpFee?: string | number | null },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  await assertMembership(userId, workspaceId);
  const doctor = await getDoctorForUser(userId);

  const existing = await prisma.doctorVisitingFee.findUnique({
    where: { doctorId_workspaceId: { doctorId: doctor.id, workspaceId } },
  });

  const fee = await prisma.doctorVisitingFee.upsert({
    where: { doctorId_workspaceId: { doctorId: doctor.id, workspaceId } },
    update: {
      visitingFee: String(data.visitingFee).trim(),
      followUpFee:
        data.followUpFee === undefined || data.followUpFee === null
          ? null
          : String(data.followUpFee).trim(),
      isActive: true,
    },
    create: {
      doctorId: doctor.id,
      workspaceId,
      visitingFee: String(data.visitingFee).trim(),
      followUpFee:
        data.followUpFee === undefined || data.followUpFee === null
          ? null
          : String(data.followUpFee).trim(),
    },
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: existing ? AuditActionType.UPDATE : AuditActionType.CREATE,
    entityType: AuditEntityType.SYSTEM,
    entityId: fee.id,
    oldValues: existing
      ? {
          visitingFee: existing.visitingFee.toString(),
          followUpFee: existing.followUpFee?.toString() ?? null,
        }
      : null,
    newValues: {
      visitingFee: fee.visitingFee.toString(),
      followUpFee: fee.followUpFee?.toString() ?? null,
    },
    metadata: { setting: "visiting_fee" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return serialize(fee);
};

const getMyFee = async (userId: string, workspaceId: string) => {
  await assertMembership(userId, workspaceId);
  const doctor = await getDoctorForUser(userId);
  const fee = await prisma.doctorVisitingFee.findUnique({
    where: { doctorId_workspaceId: { doctorId: doctor.id, workspaceId } },
  });
  return serialize(fee);
};

/** Institution/owner view: read any doctor's fee in the workspace (read-only). */
const getDoctorFee = async (
  userId: string,
  workspaceId: string,
  doctorId: string,
) => {
  await assertMembership(userId, workspaceId);
  const fee = await prisma.doctorVisitingFee.findUnique({
    where: { doctorId_workspaceId: { doctorId, workspaceId } },
  });
  return serialize(fee);
};

/**
 * Returns the doctor's configured fees for a workspace (or null when unset).
 * The appointment service picks visitingFee vs followUpFee based on the visit
 * type, then freezes the value on the appointment.
 */
const getFeeConfig = async (doctorId: string, workspaceId: string) => {
  const fee = await prisma.doctorVisitingFee.findUnique({
    where: { doctorId_workspaceId: { doctorId, workspaceId } },
  });
  if (!fee || !fee.isActive) return null;

  return {
    visitingFee: fee.visitingFee.toString(),
    followUpFee: fee.followUpFee ? fee.followUpFee.toString() : null,
  };
};

export const FeeServices = {
  upsertMyFee,
  getMyFee,
  getDoctorFee,
  getFeeConfig,
};
