import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  ContactLabel,
  AppointmentStatus,
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { checkUserVerification } from "../../utils/verificationCheck";

const createChamber = async (
  userId: string,
  data: {
    chamberName: string;
    chamberAddress: string;
    chamberEmail?: string;
    chamberSlogan?: string;
    logo?: string;
    institutionId?: string;
    phones?: string[];
    templateConfig?: any;
  },
  activeWorkspaceId?: string,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const { phones, ...chamberData } = data;

  // Resolve workspaceId: use the active workspace from the switcher first,
  // otherwise fall back to owned workspace or first membership.
  let workspaceId: string | null = activeWorkspaceId ?? null;
  if (!workspaceId) {
    const ownedWorkspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (ownedWorkspace) workspaceId = ownedWorkspace.id;
  }
  if (!workspaceId) {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });
    if (membership) workspaceId = membership.workspaceId;
  }

  if (!workspaceId) {
    throw createAppError("Workspace not found for user", Status.NOT_FOUND);
  }

  return await prisma.$transaction(async (tx) => {
    const chamber = await tx.chamber.create({
      data: {
        workspaceId,
        name: chamberData.chamberName,
        address: chamberData.chamberAddress ?? null,
        email: chamberData.chamberEmail ?? null,
        logo: chamberData.logo ?? null,
        footerText: chamberData.chamberSlogan ?? null,
        templateConfig: chamberData.templateConfig ?? {
          colorTheme: "#0f8374",
          headerStyle: "classic",
          footerStyle: "classic",
          showLogo: true,
        },
        isActive: true,
      },
    });

    if (phones && phones.length > 0) {
      const contactNumbers = phones.map((phone, index) => ({
        chamberId: chamber.id,
        phone,
        label: ContactLabel.RECEPTION,
        isPrimary: index === 0,
      }));

      await tx.contactNumber.createMany({
        data: contactNumbers,
      });
    }

    await AuditService.logAudit({
      userId,
      workspaceId,
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.CHAMBER,
      entityId: chamber.id,
      newValues: chamber,
      metadata: {
        chamberName: chamber.name,
      },
    });

    return chamber;
  });
};

const getChamberById = async (id: string) => {
  const chamber = await prisma.chamber.findFirst({
    where: { id, isActive: true },
    include: {
      contactNumbers: true,
      schedules: true,
    },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  return chamber;
};

const getMyChambers = async (userId: string) => {
  // Resolve workspace for user and return chambers in that workspace
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  let workspaceId = workspace?.id;
  if (!workspaceId) {
    const membership = await prisma.membership.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });
    workspaceId = membership?.workspaceId ?? undefined;
  }

  if (!workspaceId) return [];

  return await prisma.chamber.findMany({
    where: { workspaceId, isActive: true },
    include: { contactNumbers: true },
  });
};

const updateChamber = async (id: string, userId: string, data: any) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const { phones, ...chamberData } = data;

  const chamber = await prisma.chamber.findFirst({
    where: { id, isActive: true },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  return await prisma.$transaction(async (tx) => {
    const updatedChamber = await tx.chamber.update({
      where: { id },
      data: chamberData,
    });

    if (phones) {
      // Clear old phone records for this chamber
      await tx.contactNumber.deleteMany({
        where: { chamberId: id },
      });

      if (phones.length > 0) {
        const contactNumbers = phones.map((phone: string, index: number) => ({
          chamberId: id,
          phone,
          label: ContactLabel.RECEPTION,
          isPrimary: index === 0,
        }));
        await tx.contactNumber.createMany({
          data: contactNumbers,
        });
      }
    }

    await AuditService.logAudit({
      userId,
      workspaceId: chamber.workspaceId,
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.CHAMBER,
      entityId: id,
      oldValues: chamber,
      newValues: updatedChamber,
      metadata: {
        chamberName: updatedChamber.name,
      },
    });

    return updatedChamber;
  });
};

const deleteChamber = async (id: string, userId: string) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const chamber = await prisma.chamber.findUnique({
    where: { id },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  // Soft delete (mark inactive)
  const deleted = await prisma.chamber.update({
    where: { id },
    data: {
      isActive: false,
    },
  });

  await AuditService.logAudit({
    userId,
    workspaceId: chamber.workspaceId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.CHAMBER,
    entityId: id,
    oldValues: { isActive: chamber.isActive },
    newValues: { isActive: deleted.isActive },
    metadata: {
      chamberName: chamber.name,
    },
  });
};

const addChamberSchedule = async (
  chamberId: string,
  scheduleData: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    maxSerials: number;
  },
) => {
  const chamber = await prisma.chamber.findUnique({
    where: { id: chamberId },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  return await prisma.chamberSchedule.create({
    data: {
      chamberId,
      ...scheduleData,
    },
  });
};

const deleteChamberSchedule = async (scheduleId: string) => {
  const schedule = await prisma.chamberSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    throw createAppError("Schedule not found", Status.NOT_FOUND);
  }

  await prisma.chamberSchedule.delete({
    where: { id: scheduleId },
  });
};

const createAppointment = async (
  workspaceId: string,
  chamberId: string,
  appointmentData: {
    doctorId: string;
    patientId: string;
    appointmentDate: string;
  },
) => {
  const dateObj = new Date(appointmentData.appointmentDate);
  if (isNaN(dateObj.getTime())) {
    throw createAppError("Invalid appointment date", Status.BAD_REQUEST);
  }

  // BOLA/IDOR: the chamber and patient must belong to the active workspace.
  const chamber = await prisma.chamber.findFirst({
    where: { id: chamberId, workspaceId },
  });

  if (!chamber) {
    throw createAppError("Chamber not found in workspace", Status.NOT_FOUND);
  }

  const patient = await prisma.patient.findFirst({
    where: { id: appointmentData.patientId, workspaceId, isDeleted: false },
  });

  if (!patient) {
    throw createAppError("Patient not found in workspace", Status.NOT_FOUND);
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
  const shortDay = dateObj
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const dayOfWeek = DAY_MAP[shortDay] ?? shortDay;

  // Retry on unique-serial collisions so concurrent bookings never double-book
  // (Section 16.2).
  let appointment: any = null;

  for (let attempt = 0; attempt < 5 && !appointment; attempt++) {
    try {
      appointment = await prisma.$transaction(async (tx) => {
        // Enforce daily capacity from chamber schedule
        const schedule = await tx.chamberSchedule.findFirst({
          where: { chamberId, dayOfWeek },
          select: { maxSerials: true },
        });

        const capacity = schedule?.maxSerials ?? null;

        const lastAppointment = await tx.appointment.findFirst({
          where: {
            chamberId,
            doctorId: appointmentData.doctorId,
            appointmentDate: dateObj,
          },
          orderBy: {
            serialNo: "desc",
          },
        });

        const nextSerial =
          (lastAppointment ? lastAppointment.serialNo + 1 : 1) + attempt;

        if (capacity !== null && nextSerial > capacity) {
          throw createAppError(
            `No slots available. The chamber's daily capacity of ${capacity} appointments for ${dayOfWeek} has been reached.`,
            Status.CONFLICT,
          );
        }

        return tx.appointment.create({
          data: {
            chamberId,
            doctorId: appointmentData.doctorId,
            patientId: appointmentData.patientId,
            appointmentDate: dateObj,
            serialNo: nextSerial,
            status: AppointmentStatus.PENDING,
          },
          include: {
            patient: true,
            doctor: true,
            chamber: true,
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

  return appointment;
};

const getChamberAppointments = async (
  workspaceId: string,
  chamberId: string,
  date?: string,
) => {
  // BOLA/IDOR: verify the chamber belongs to the active workspace first.
  const chamber = await prisma.chamber.findFirst({
    where: { id: chamberId, workspaceId },
    select: { id: true },
  });

  if (!chamber) {
    throw createAppError("Chamber not found in workspace", Status.NOT_FOUND);
  }

  const filterDate = date ? new Date(date) : new Date();

  return await prisma.appointment.findMany({
    where: {
      chamberId,
      appointmentDate: {
        equals: filterDate,
      },
    },
    orderBy: {
      serialNo: "asc",
    },
    include: {
      patient: {
        select: {
          name: true,
          age: true,
          gender: true,
          phone: true,
        },
      },
    },
  });
};

export const ChamberServices = {
  createChamber,
  getChamberById,
  getMyChambers,
  updateChamber,
  deleteChamber,
  addChamberSchedule,
  deleteChamberSchedule,
  createAppointment,
  getChamberAppointments,
};
