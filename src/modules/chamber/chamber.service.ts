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
import { SubscriptionServices } from "../subscription/subscription.service";
import { FeatureServices } from "../feature/feature.service";
import { normalizeBangladeshPhone } from "../../utils/phone";
import {
  hasFooterConfig,
  hasText,
  hasWatermarkConfig,
} from "../../utils/branding";


const assertChamberBrandingAccess = async (
  userId: string,
  workspaceId: string,
  data: { logo?: unknown; chamberSlogan?: unknown; templateConfig?: unknown },
) => {
  const brandingTouched = hasText(data.logo) || hasText(data.chamberSlogan);
  const config = data.templateConfig as Parameters<typeof hasFooterConfig>[0];

  if (brandingTouched || hasFooterConfig(config)) {
    await FeatureServices.checkFeatureAccess({
      featureKey: "custom_branding",
      userId,
      workspaceId,
      trackUsage: false,
      incrementBy: 0,
    });
  }

  if (hasWatermarkConfig(config)) {
    await FeatureServices.checkFeatureAccess({
      featureKey: "watermark",
      userId,
      workspaceId,
      trackUsage: false,
      incrementBy: 0,
    });
  }
};

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
  
  await checkUserVerification(userId);

  const { phones, ...chamberData } = data;

  
  
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

  
  await SubscriptionServices.assertChamberLimit(userId, workspaceId);

  
  
  await assertChamberBrandingAccess(userId, workspaceId, chamberData);

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
        
        phone: normalizeBangladeshPhone(phone),
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

const getChamberById = async (id: string, workspaceId: string) => {
  const chamber = await prisma.chamber.findFirst({
    where: { id, workspaceId, isActive: true },
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

const getMyChambers = async (userId: string, workspaceId: string) => {
  
  
  void userId;

  return await prisma.chamber.findMany({
    where: { workspaceId, isActive: true },
    include: { contactNumbers: true },
  });
};

const updateChamber = async (
  id: string,
  userId: string,
  workspaceId: string,
  data: any,
) => {
  
  await checkUserVerification(userId);

  const { phones, ...chamberData } = data;

  
  
  await assertChamberBrandingAccess(userId, workspaceId, chamberData);

  const chamber = await prisma.chamber.findFirst({
    where: { id, workspaceId, isActive: true },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  
  
  
  
  const updateData: Record<string, any> = {};
  const name = chamberData.chamberName ?? chamberData.name;
  const address = chamberData.chamberAddress ?? chamberData.address;
  const email = chamberData.chamberEmail ?? chamberData.email;
  const slogan = chamberData.chamberSlogan ?? chamberData.footerText;

  if (name !== undefined) updateData.name = name;
  if (address !== undefined) updateData.address = address;
  if (email !== undefined) updateData.email = email;
  if (slogan !== undefined) updateData.footerText = slogan;
  if (chamberData.logo !== undefined) updateData.logo = chamberData.logo;
  if (chamberData.templateConfig !== undefined)
    updateData.templateConfig = chamberData.templateConfig;
  if (chamberData.isActive !== undefined)
    updateData.isActive = chamberData.isActive;

  return await prisma.$transaction(async (tx) => {
    const updatedChamber = await tx.chamber.update({
      where: { id },
      data: updateData,
    });

    if (phones) {
      
      await tx.contactNumber.deleteMany({
        where: { chamberId: id },
      });

      if (phones.length > 0) {
        const contactNumbers = phones.map((phone: string, index: number) => ({
          chamberId: id,
          phone: normalizeBangladeshPhone(phone),
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

const deleteChamber = async (
  id: string,
  userId: string,
  workspaceId: string,
) => {
  
  await checkUserVerification(userId);

  const chamber = await prisma.chamber.findFirst({
    where: { id, workspaceId },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  
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
  workspaceId: string,
  chamberId: string,
  scheduleData: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    maxSerials: number;
  },
) => {
  const chamber = await prisma.chamber.findFirst({
    where: { id: chamberId, workspaceId },
  });

  if (!chamber) {
    throw createAppError("Chamber not found in workspace", Status.NOT_FOUND);
  }

  return await prisma.chamberSchedule.create({
    data: {
      chamberId,
      ...scheduleData,
    },
  });
};

const deleteChamberSchedule = async (
  workspaceId: string,
  scheduleId: string,
) => {
  const schedule = await prisma.chamberSchedule.findUnique({
    where: { id: scheduleId },
    include: { chamber: { select: { workspaceId: true } } },
  });

  if (!schedule || schedule.chamber.workspaceId !== workspaceId) {
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

  
  
  let appointment: any = null;

  for (let attempt = 0; attempt < 5 && !appointment; attempt++) {
    try {
      appointment = await prisma.$transaction(async (tx) => {
        
        const schedule = await tx.chamberSchedule.findFirst({
          where: { chamberId, dayOfWeek },
          select: { maxSerials: true },
        });

        const capacity = schedule?.maxSerials ?? null;

        const lastAppointment = await tx.appointment.findFirst({
          where: {
            workspaceId,
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
            workspaceId,
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
