import {
  chamberScopeFilter,
  scopeFilter,
  type RequestScope,
} from "../../utils/chamberScope";
import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { AuditService } from "../audit/audit.service";
import {
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { checkUserVerification } from "../../utils/verificationCheck";
import { normalizeBangladeshPhone } from "../../utils/phone";

const createPatient = async (
  userId: string,
  workspaceId: string,
  patientData: {
    name: string;
    age: number;
    gender: "MALE" | "FEMALE";
    weight?: number;
    phone?: string;
    address?: string;
    bloodGroup?: string;
    allergies?: string;
    chronicDiseases?: string;
    emergencyContact?: string;
    patientNotes?: string;
  },
  // Chamber the patient is being registered in (null = personal workspace).
  chamberId: string | null = null,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  // Store the canonical domestic form (+8801712345678 -> 01712345678) so the
  // same number never ends up with multiple representations.
  const data = {
    ...patientData,
    ...(patientData.phone
      ? { phone: normalizeBangladeshPhone(patientData.phone) }
      : {}),
    ...(patientData.emergencyContact
      ? { emergencyContact: normalizeBangladeshPhone(patientData.emergencyContact) }
      : {}),
  };

  // Duplicate detection is workspace-scoped (Section 11): the same phone in a
  // different workspace must not block registration here.
  if (data.phone) {
    const existingPatient = await prisma.patient.findFirst({
      where: {
        phone: data.phone,
        workspaceId,
        // Duplicates are only checked within the SAME chamber context — the
        // same person may legitimately have a record in another chamber.
        ...chamberScopeFilter(chamberId),
        isDeleted: false,
      },
    });

    if (existingPatient) {
      throw createAppError(
        `Patient with this phone number (${data.phone}) already exists under your profile as "${existingPatient.name}".`,
        Status.CONFLICT,
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        doctorId: doctor.id,
        workspaceId,
        // Canonical chamber ownership for the record.
        chamberId,
        ...data,
      },
    });

    await AuditService.logAudit({
      userId,
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.PATIENT,
      entityId: patient.id,
      newValues: {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
      },
      metadata: {
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        chronicDiseases: patient.chronicDiseases,
      },
    });

    return patient;
  });
};

const getPatientById = async (
  id: string,
  workspaceId: string,
  scope?: RequestScope,
) => {
  // Workspace-scoped lookup (Section 6.4): never return another workspace's
  // patient by guessing an ID.
  const patient = await prisma.patient.findFirst({
    where: {
      id,
      // Current-workspace mode also pins the chamber, so a record from another
      // chamber is not reachable even with a known ID.
      ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
      isDeleted: false,
    },
    include: {
      prescriptions: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          status: true,
          pdfUrl: true,
          diagnosis: true,
          chamber: { select: { name: true } },
        },
      },
    },
  });

  if (!patient) {
    throw createAppError("Patient not found", Status.NOT_FOUND);
  }

  return patient;
};

const updatePatient = async (
  id: string,
  userId: string,
  workspaceId: string,
  data: any,
  scope?: RequestScope,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      // Current-workspace mode also pins the chamber, so a record from another
      // chamber is not reachable even with a known ID.
      ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
      isDeleted: false,
    },
  });

  if (!patient) {
    throw createAppError("Patient not found", Status.NOT_FOUND);
  }

  // Normalise phone values to the canonical domestic form on update too.
  const updateData = {
    ...data,
    ...(typeof data?.phone === "string" && data.phone
      ? { phone: normalizeBangladeshPhone(data.phone) }
      : {}),
    ...(typeof data?.emergencyContact === "string" && data.emergencyContact
      ? { emergencyContact: normalizeBangladeshPhone(data.emergencyContact) }
      : {}),
  };

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.patient.update({
      where: { id },
      data: updateData,
    });

    await AuditService.logAudit({
      userId,
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.PATIENT,
      entityId: id,
      oldValues: {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
      },
      newValues: {
        name: updated.name,
        age: updated.age,
        gender: updated.gender,
        phone: updated.phone,
      },
      metadata: {
        changedFields: Object.keys(data || {}),
      },
    });

    return updated;
  });
};

const deletePatient = async (
  id: string,
  userId: string,
  workspaceId: string,
  scope?: RequestScope,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      // Current-workspace mode also pins the chamber, so a record from another
      // chamber is not reachable even with a known ID.
      ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
      isDeleted: false,
    },
  });

  if (!patient) {
    throw createAppError("Patient not found", Status.NOT_FOUND);
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.patient.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await AuditService.logAudit({
      userId,
      actionType: AuditActionType.DELETE,
      entityType: AuditEntityType.PATIENT,
      entityId: id,
      oldValues: {
        name: patient.name,
        isDeleted: patient.isDeleted,
      },
      newValues: {
        name: deleted.name,
        isDeleted: deleted.isDeleted,
        deletedAt: deleted.deletedAt,
      },
      metadata: {
        deletedReason: "Patient deleted",
      },
    });
  });
};

const searchPatients = async (
  userId: string,
  workspaceId: string,
  query: string,
  page: number = 1,
  limit: number = 10,
  scope?: RequestScope,
) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  const skip = (page - 1) * limit;

  // Fuzzy match on name or phone, strictly scoped to the active workspace so
  // patients never leak across workspaces (Section 6.4).
  const whereClause = {
    isDeleted: false,
    workspaceId,
    // Chamber isolation by default; workspaceScope=all widens to every
    // workspace the user is authorized for.
    ...(scope ? (scopeFilter(scope) as any) : {}),
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { phone: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.patient.count({
      where: whereClause,
    }),
  ]);

  return {
    patients,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getPatientTimeline = async (
  id: string,
  workspaceId: string,
  scope?: RequestScope,
) => {
  const patient = await prisma.patient.findFirst({
    where: {
      id,
      // Current-workspace mode also pins the chamber, so a record from another
      // chamber is not reachable even with a known ID.
      ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
      isDeleted: false,
    },
  });

  if (!patient) {
    throw createAppError("Patient not found", Status.NOT_FOUND);
  }

  const [appointments, prescriptions, auditEntries] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: id },
      orderBy: { appointmentDate: "desc" },
      select: {
        id: true,
        appointmentDate: true,
        status: true,
        serialNo: true,
        notes: true,
        createdAt: true,
        chamber: { select: { name: true } },
        doctor: { select: { name: true } },
      },
    }),
    prisma.prescription.findMany({
      where: { patientId: id, isDeleted: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        diagnosis: true,
        complaints: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { entityId: id, entityType: AuditEntityType.PATIENT },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const timeline: Array<Record<string, unknown>> = [
    ...appointments.map((a) => ({
      type: "appointment",
      id: a.id,
      date: a.appointmentDate,
      chamberName: a.chamber?.name,
      doctorName: a.doctor?.name,
      status: a.status,
      serialNo: a.serialNo,
      notes: a.notes,
    })),
    ...prescriptions.map((p) => ({
      type: "prescription",
      id: p.id,
      date: p.createdAt,
      diagnosis: p.diagnosis,
      complaints: p.complaints,
      status: p.status,
    })),
    ...auditEntries.map((e) => ({
      type: "audit",
      id: e.id,
      date: e.createdAt,
      actionType: e.actionType,
      metadata: e.metadata,
    })),
  ].sort(
    (a, b) =>
      new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime(),
  );

  return timeline;
};

export const PatientServices = {
  createPatient,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
  getPatientTimeline,
};
