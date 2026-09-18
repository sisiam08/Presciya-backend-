import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  AppointmentStatus,
  AuditActionType,
  AuditEntityType,
  NotificationType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { NotificationServices } from "../notification/notification.service";
import { checkUserVerification } from "../../utils/verificationCheck";
import { getPaginationParams } from "../../utils/pagination";

const createAppointment = async (
  userId: string,
  workspaceId: string,
  data: {
    chamberId: string;
    doctorId: string;
    patientId: string;
    appointmentDate: string;
    notes?: string;
  },
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  // Verify chamber/doctor/patient belong to workspace
  const chamber = await prisma.chamber.findUnique({
    where: { id: data.chamberId },
  });
  if (!chamber || chamber.workspaceId !== workspaceId) {
    throw createAppError("Chamber not found in workspace", Status.NOT_FOUND);
  }

  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
  });
  if (!patient || patient.workspaceId !== workspaceId) {
    throw createAppError("Patient not found in workspace", Status.NOT_FOUND);
  }

  const appointmentDate = new Date(data.appointmentDate);
  if (isNaN(appointmentDate.getTime())) {
    throw createAppError("Invalid appointment date", Status.BAD_REQUEST);
  }

  // Chamber schedules store full weekday names (e.g. "SATURDAY")
  const DAY_MAP: Record<string, string> = {
    SUN: "SUNDAY",
    MON: "MONDAY",
    TUE: "TUESDAY",
    WED: "WEDNESDAY",
    THU: "THURSDAY",
    FRI: "FRIDAY",
    SAT: "SATURDAY",
  };
  const shortDay = appointmentDate
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase(); // e.g. "MON"
  const dayOfWeek = DAY_MAP[shortDay] ?? shortDay;

  // Serial numbers are generated inside a transaction and protected by the
  // unique constraint (chamberId, doctorId, appointmentDate, serialNo). On a
  // concurrent collision we retry with the next serial so no two patients are
  // ever double-booked (Section 16.2).
  let appointment: Awaited<ReturnType<typeof prisma.appointment.create>> | null =
    null;

  for (let attempt = 0; attempt < 5 && !appointment; attempt++) {
    try {
      appointment = await prisma.$transaction(async (tx) => {
        // Enforce daily capacity from chamber schedule
        const schedule = await tx.chamberSchedule.findFirst({
          where: { chamberId: data.chamberId, dayOfWeek },
          select: { maxSerials: true },
        });

        const capacity = schedule?.maxSerials ?? null;

        const existingCount = await tx.appointment.count({
          where: {
            chamberId: data.chamberId,
            doctorId: data.doctorId,
            appointmentDate,
          },
        });

        if (capacity !== null && existingCount >= capacity) {
          throw createAppError(
            `No slots available. The chamber's daily capacity of ${capacity} appointments for ${dayOfWeek} has been reached.`,
            Status.CONFLICT,
          );
        }

        const serialNo = existingCount + 1 + attempt;

        return tx.appointment.create({
          data: {
            chamberId: data.chamberId,
            doctorId: data.doctorId,
            patientId: data.patientId,
            appointmentDate,
            serialNo,
            notes: data.notes ?? null,
            status: AppointmentStatus.CONFIRMED,
          },
        });
      });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }

  if (!appointment) {
    throw createAppError(
      "Could not book the appointment due to a slot conflict. Please try again.",
      Status.CONFLICT,
    );
  }

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.APPOINTMENT,
    entityId: appointment.id,
    newValues: appointment,
    metadata: {
      appointmentDate: appointment.appointmentDate,
      serialNo: appointment.serialNo,
      status: appointment.status,
    },
  });

  const doctor = await prisma.doctor.findUnique({
    where: { id: appointment.doctorId },
    select: { userId: true },
  });
  if (doctor) {
    await NotificationServices.createNotification({
      userId: doctor.userId,
      title: "New appointment booked",
      message: `A new appointment (serial #${appointment.serialNo}) has been booked for ${appointment.appointmentDate.toLocaleDateString()}.`,
      type: NotificationType.APPOINTMENT,
    });
  }

  return appointment;
};

const updateStatus = async (
  appointmentId: string,
  userId: string,
  workspaceId: string,
  status: AppointmentStatus,
  cancelReason?: string,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { chamber: { select: { workspaceId: true } } },
  });
  if (!appt) throw createAppError("Appointment not found", Status.NOT_FOUND);

  // BOLA/IDOR: the appointment must belong to the caller's active workspace.
  if (appt.chamber.workspaceId !== workspaceId) {
    throw createAppError("Appointment not found", Status.NOT_FOUND);
  }

  const chamber = appt.chamber;

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status, cancelReason: cancelReason ?? null },
  });

  await AuditService.logAudit({
    userId,
    workspaceId: chamber?.workspaceId ?? undefined,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.APPOINTMENT,
    entityId: appointmentId,
    oldValues: { status: appt.status, cancelReason: appt.cancelReason },
    newValues: { status: updated.status, cancelReason: updated.cancelReason },
    metadata: {
      appointmentDate: updated.appointmentDate,
      reason: cancelReason,
    },
  });

  if (
    status === AppointmentStatus.CANCELLED ||
    status === AppointmentStatus.COMPLETED
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: appt.doctorId },
      select: { userId: true },
    });
    if (doctor) {
      await NotificationServices.createNotification({
        userId: doctor.userId,
        title:
          status === AppointmentStatus.CANCELLED
            ? "Appointment canceled"
            : "Appointment completed",
        message: `Appointment on ${appt.appointmentDate.toLocaleDateString()} has been marked as ${status.toLowerCase()}.`,
        type: NotificationType.APPOINTMENT,
      });
    }
  }

  return updated;
};

const listAppointments = async (
  workspaceId: string,
  filters: { doctorId?: string; patientId?: string; from?: Date; to?: Date },
  page: unknown = 1,
  limit: unknown = 20,
) => {
  const { page: pageNum, limit: limitNum, skip } = getPaginationParams(
    page,
    limit,
  );

  const chambers = await prisma.chamber.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const chamberIds = chambers.map((c) => c.id);

  const where: any = { chamberId: { in: chamberIds } };
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.from || filters.to) where.appointmentDate = {};
  if (filters.from) where.appointmentDate.gte = filters.from;
  if (filters.to) where.appointmentDate.lte = filters.to;

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { appointmentDate: "asc" },
      include: {
        patient: { select: { id: true, name: true, phone: true, age: true, gender: true } },
        doctor: { select: { id: true, name: true } },
        chamber: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    items,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const AppointmentService = {
  createAppointment,
  updateStatus,
  listAppointments,
};
