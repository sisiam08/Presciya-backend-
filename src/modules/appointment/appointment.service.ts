import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  AppointmentStatus,
  AppointmentType,
  AppointmentPaymentStatus,
  AuditActionType,
  AuditEntityType,
  MembershipStatus,
  NotificationType,
  WorkspaceType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { NotificationServices } from "../notification/notification.service";
import { checkUserVerification } from "../../utils/verificationCheck";
import { getPaginationParams } from "../../utils/pagination";
import { FeeServices } from "../fee/fee.service";
import { RevenueServices } from "../revenue/revenue.service";
import { SubscriptionServices } from "../subscription/subscription.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const parseDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      0,
      0,
      0,
      0,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createAppError("Invalid appointment date", Status.BAD_REQUEST);
  }
  return parsed;
};

const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const nextDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);

const resolveWorkspace = async (workspaceId: string) => {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, type: true },
  });
  if (!ws) throw createAppError("Workspace not found", Status.NOT_FOUND);
  return ws;
};

/** A doctor user resolves to their own Doctor profile. */
const getDoctorForUser = async (userId: string) =>
  prisma.doctor.findUnique({ where: { userId } });

const resolveDoctorId = async (
  userId: string,
  workspaceId: string,
  requestedDoctorId?: string,
): Promise<string> => {
  const own = await getDoctorForUser(userId);
  const doctorId = requestedDoctorId || own?.id;
  if (!doctorId) {
    throw createAppError(
      "A doctor is required for this appointment",
      Status.BAD_REQUEST,
    );
  }

  // The doctor must be a member of the workspace (BOLA/IDOR guard).
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true, userId: true },
  });
  if (!doctor) throw createAppError("Doctor not found", Status.NOT_FOUND);

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId: doctor.userId, workspaceId },
    },
    select: { status: true },
  });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw createAppError(
      "Doctor does not belong to this workspace",
      Status.FORBIDDEN,
    );
  }
  return doctor.id;
};

// Discounts / free consultations require a "manage" role. Assistants may
// record full payments but cannot reduce the fee unless explicitly promoted.
const DISCOUNT_ROLES = ["OWNER", "ADMIN", "DOCTOR", "MANAGER"];
const assertCanDiscount = async (userId: string, workspaceId: string) => {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  if (!membership || !DISCOUNT_ROLES.includes(membership.role)) {
    throw createAppError(
      "You do not have permission to apply discounts or free consultations",
      Status.FORBIDDEN,
    );
  }
};

const assertPatient = async (patientId: string, workspaceId: string) => {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, workspaceId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!patient) {
    throw createAppError("Patient not found in workspace", Status.NOT_FOUND);
  }
  return patient;
};

// ─── Fee + payment snapshot ──────────────────────────────────────────────────

const buildFeeSnapshot = async (
  doctorId: string,
  workspaceId: string,
  appointmentType: AppointmentType,
  discountInput: number,
) => {
  const config = await FeeServices.getFeeConfig(doctorId, workspaceId);

  // Follow-up uses the follow-up fee when configured, else the normal fee.
  const base =
    appointmentType === AppointmentType.FOLLOW_UP && config?.followUpFee
      ? Number(config.followUpFee)
      : Number(config?.visitingFee ?? 0);

  const discount = Math.min(Math.max(discountInput, 0), base);
  const payable = round2(base - discount);

  return {
    visitingFee: base,
    discount,
    payableAmount: payable,
  };
};

/**
 * Enforces the plan's daily appointment limit for a doctor. The plan limit is
 * admin-configurable (PlanFeature for the `appointments` feature); null means
 * unlimited. Counts the doctor's NON-cancelled appointments for the day across
 * ALL workspaces so switching workspaces cannot bypass the limit. Runs inside
 * the create transaction to keep the window small.
 */
const assertDailyAppointmentLimit = async (
  tx: any,
  doctorId: string,
  userId: string,
  workspaceId: string,
  appointmentDate: Date,
) => {
  const activePlan = await SubscriptionServices.getActivePlan({
    workspaceId,
    userId,
  });
  if (!activePlan) return;

  const feature = await prisma.feature.findUnique({
    where: { key: "appointments" },
    select: { id: true },
  });
  if (!feature) return;

  const planFeature = await tx.planFeature.findUnique({
    where: {
      variantId_featureId: {
        variantId: activePlan.variant.id,
        featureId: feature.id,
      },
    },
    select: { limitValue: true },
  });

  const limit = planFeature?.limitValue ?? null;
  if (limit === null) return; // unlimited

  const count = await tx.appointment.count({
    where: {
      doctorId,
      appointmentDate: {
        gte: dayStart(appointmentDate),
        lt: nextDay(appointmentDate),
      },
      status: { not: AppointmentStatus.CANCELLED },
    },
  });

  if (count >= limit) {
    throw createAppError(
      `Daily appointment limit reached (${limit} per day). Upgrade your plan for more.`,
      Status.PAYMENT_REQUIRED,
      true,
      "DAILY_LIMIT_REACHED",
    );
  }
};

// ─── Serial generation (workspace-scoped, daily reset) ───────────────────────

const generateSerial = async (
  workspaceId: string,
  appointmentDate: Date,
): Promise<number> => {
  const last = await prisma.appointment.findFirst({
    where: {
      workspaceId,
      appointmentDate: {
        gte: dayStart(appointmentDate),
        lt: nextDay(appointmentDate),
      },
    },
    orderBy: { serialNo: "desc" },
    select: { serialNo: true },
  });
  return (last?.serialNo ?? 0) + 1;
};

// ─── Finance integration (idempotent) ────────────────────────────────────────

/**
 * Records the consultation income for a paid appointment. Idempotent: an
 * existing (non-deleted) INCOME transaction for the appointment is reused, so
 * repeated payment calls can never double-count revenue.
 */
const recordAppointmentIncome = async (
  tx: any,
  appointment: {
    id: string;
    workspaceId: string;
    paidAmount: any;
    paymentMethod: any;
    appointmentDate: Date;
  },
  createdById: string,
  patientName: string,
) => {
  const existing = await tx.financialTransaction.findFirst({
    where: { appointmentId: appointment.id, isDeleted: false },
    select: { id: true },
  });
  if (existing) return existing;

  // Prefer a "Consultation" income category; fall back to any active income
  // category (system or workspace-specific).
  const category =
    (await tx.financialCategory.findFirst({
      where: {
        type: "INCOME",
        isActive: true,
        name: "Consultation",
        OR: [{ workspaceId: null }, { workspaceId: appointment.workspaceId }],
      },
    })) ??
    (await tx.financialCategory.findFirst({
      where: {
        type: "INCOME",
        isActive: true,
        OR: [{ workspaceId: null }, { workspaceId: appointment.workspaceId }],
      },
    }));

  if (!category) return null;

  return tx.financialTransaction.create({
    data: {
      workspaceId: appointment.workspaceId,
      createdById,
      type: "INCOME",
      amount: appointment.paidAmount,
      categoryId: category.id,
      paymentMethod: appointment.paymentMethod ?? "CASH",
      description: `Consultation fee — ${patientName}`,
      transactionDate: appointment.appointmentDate,
      appointmentId: appointment.id,
    },
  });
};

// ─── Create ──────────────────────────────────────────────────────────────────

const createAppointment = async (
  userId: string,
  workspaceId: string,
  data: {
    patientId: string;
    doctorId?: string;
    chamberId?: string;
    appointmentDate: string;
    notes?: string;
    appointmentType?: AppointmentType;
    discount?: number | string;
    paymentStatus?: AppointmentPaymentStatus;
    paymentMethod?: any;
    paidAmount?: number | string;
    followUpOfId?: string;
  },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  await checkUserVerification(userId);

  const ws = await resolveWorkspace(workspaceId);
  // Personal workspaces normally have no appointment workflow, but a personal
  // practice that has chambers keeps the existing chamber-based booking flow.
  if (ws.type === WorkspaceType.PERSONAL) {
    const chamberCount = await prisma.chamber.count({ where: { workspaceId } });
    if (chamberCount === 0) {
      throw createAppError(
        "Appointments require a chamber. Add a chamber, or use a chamber / hospital workspace.",
        Status.BAD_REQUEST,
      );
    }
  }

  const patient = await assertPatient(data.patientId, workspaceId);
  const doctorId = await resolveDoctorId(userId, workspaceId, data.doctorId);

  if (data.chamberId) {
    const chamber = await prisma.chamber.findFirst({
      where: { id: data.chamberId, workspaceId },
      select: { id: true },
    });
    if (!chamber) {
      throw createAppError("Chamber not found in workspace", Status.NOT_FOUND);
    }
  }

  const appointmentDate = parseDate(data.appointmentDate);
  const appointmentType = data.appointmentType ?? AppointmentType.NORMAL;
  const discountInput = data.discount !== undefined ? Number(data.discount) : 0;
  if (discountInput < 0 || !Number.isFinite(discountInput)) {
    throw createAppError("Discount cannot be negative", Status.BAD_REQUEST);
  }
  if (discountInput > 0) {
    await assertCanDiscount(userId, workspaceId);
  }

  const snapshot = await buildFeeSnapshot(
    doctorId,
    workspaceId,
    appointmentType,
    discountInput,
  );

  // Payment intent (optional): create as PENDING and settle later, or settle
  // immediately as PAID / FREE.
  const intent = data.paymentStatus ?? AppointmentPaymentStatus.PENDING;

  let appointment: any = null;
  for (let attempt = 0; attempt < 5 && !appointment; attempt++) {
    try {
      appointment = await prisma.$transaction(async (tx) => {
        // Enforce the admin-configured daily appointment limit.
        await assertDailyAppointmentLimit(
          tx,
          doctorId,
          userId,
          workspaceId,
          appointmentDate,
        );

        const serialNo =
          (await generateSerial(workspaceId, appointmentDate)) + attempt;

        return tx.appointment.create({
          data: {
            workspaceId,
            chamberId: data.chamberId ?? null,
            doctorId,
            patientId: data.patientId,
            appointmentDate,
            serialNo,
            notes: data.notes ?? null,
            status: AppointmentStatus.CONFIRMED,
            appointmentType,
            visitingFee: String(snapshot.visitingFee),
            discount: String(snapshot.discount),
            payableAmount: String(snapshot.payableAmount),
            paymentStatus: AppointmentPaymentStatus.PENDING,
            followUpOfId: data.followUpOfId ?? null,
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
    newValues: {
      serialNo: appointment.serialNo,
      appointmentDate: appointment.appointmentDate,
      appointmentType: appointment.appointmentType,
      visitingFee: snapshot.visitingFee,
      discount: snapshot.discount,
      payableAmount: snapshot.payableAmount,
      paymentStatus: appointment.paymentStatus,
    },
    metadata: { source: data.followUpOfId ? "follow_up" : "appointment" },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  // Settle immediately when requested.
  if (
    intent === AppointmentPaymentStatus.PAID ||
    intent === AppointmentPaymentStatus.FREE
  ) {
    return recordPayment(
      appointment.id,
      userId,
      workspaceId,
      {
        markFree: intent === AppointmentPaymentStatus.FREE,
        paidAmount: data.paidAmount,
        paymentMethod: data.paymentMethod,
        discount: data.discount,
      },
      meta,
    );
  }

  // Notify the doctor.
  const doctor = await prisma.doctor.findUnique({
    where: { id: appointment.doctorId },
    select: { userId: true },
  });
  if (doctor) {
    await NotificationServices.createNotification({
      userId: doctor.userId,
      title: "New appointment booked",
      message: `Serial #${appointment.serialNo} on ${appointment.appointmentDate.toLocaleDateString()}.`,
      type: NotificationType.APPOINTMENT,
    });
  }

  return appointment;
};

// ─── Payment ─────────────────────────────────────────────────────────────────

const recordPayment = async (
  appointmentId: string,
  userId: string,
  workspaceId: string,
  data: {
    paidAmount?: number | string | undefined;
    paymentMethod?: any;
    discount?: number | string | undefined;
    markFree?: boolean | undefined;
  },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { select: { name: true } } },
  });
  if (!appt || appt.workspaceId !== workspaceId) {
    throw createAppError("Appointment not found", Status.NOT_FOUND);
  }

  // Idempotency: never double-charge a paid appointment.
  if (appt.paymentStatus === AppointmentPaymentStatus.PAID) {
    throw createAppError(
      "This appointment is already paid",
      Status.CONFLICT,
      true,
      "ALREADY_PAID",
    );
  }
  if (
    appt.paymentStatus === AppointmentPaymentStatus.CANCELLED ||
    appt.paymentStatus === AppointmentPaymentStatus.REFUNDED
  ) {
    throw createAppError(
      `Cannot record payment for a ${appt.paymentStatus.toLowerCase()} appointment`,
      Status.BAD_REQUEST,
    );
  }

  const ws = await resolveWorkspace(workspaceId);
  const visitingFee = Number(appt.visitingFee ?? 0);
  const discount =
    data.discount !== undefined
      ? Math.min(Math.max(Number(data.discount), 0), visitingFee)
      : Number(appt.discount);
  const payable = round2(visitingFee - discount);

  // Changing the discount or waiving the fee requires a manage role.
  const discountChanged =
    data.discount !== undefined && Number(data.discount) !== Number(appt.discount);
  if (discountChanged || data.markFree) {
    await assertCanDiscount(userId, workspaceId);
  }

  const markFree = Boolean(data.markFree) || payable === 0;
  const finalPaid = markFree
    ? 0
    : Math.min(
        Math.max(
          data.paidAmount !== undefined ? Number(data.paidAmount) : payable,
          0,
        ),
        payable,
      );

  const paymentStatus = markFree
    ? AppointmentPaymentStatus.FREE
    : AppointmentPaymentStatus.PAID;

  // Revenue split snapshot (institution workspaces only, and only when money
  // actually changed hands).
  let revenueSharePercent: number | null = null;
  let hospitalShareAmount: number | null = null;
  let doctorShareAmount: number | null = null;
  if (ws.type === WorkspaceType.INSTITUTION && !markFree && finalPaid > 0) {
    revenueSharePercent = await RevenueServices.resolveSharePercent(
      workspaceId,
      appt.doctorId,
    );
    hospitalShareAmount = round2((finalPaid * revenueSharePercent) / 100);
    doctorShareAmount = round2(finalPaid - hospitalShareAmount);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        discount: String(discount),
        payableAmount: String(payable),
        paidAmount: String(finalPaid),
        paymentStatus,
        paymentMethod: markFree ? null : data.paymentMethod ?? "CASH",
        paidAt: new Date(),
        revenueSharePercent:
          revenueSharePercent === null ? null : String(revenueSharePercent),
        hospitalShareAmount:
          hospitalShareAmount === null ? null : String(hospitalShareAmount),
        doctorShareAmount:
          doctorShareAmount === null ? null : String(doctorShareAmount),
      },
    });

    if (!markFree && finalPaid > 0) {
      await recordAppointmentIncome(
        tx,
        row,
        userId,
        appt.patient?.name ?? "Patient",
      );
    }

    return row;
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: markFree ? AuditActionType.UPDATE : AuditActionType.CREATE,
    entityType: AuditEntityType.APPOINTMENT,
    entityId: appointmentId,
    oldValues: {
      paymentStatus: appt.paymentStatus,
      paidAmount: appt.paidAmount.toString(),
    },
    newValues: {
      paymentStatus: updated.paymentStatus,
      visitingFee,
      discount,
      payableAmount: payable,
      paidAmount: finalPaid,
      revenueSharePercent,
      hospitalShareAmount,
      doctorShareAmount,
    },
    metadata: {
      event: markFree ? "free_appointment" : "payment_recorded",
      discountApplied: discount > 0,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return updated;
};

// ─── Search ──────────────────────────────────────────────────────────────────

/** Today's appointments for the workspace (serial / phone / name search). */
const searchToday = async (
  userId: string,
  workspaceId: string,
  query: string,
  doctorId?: string,
) => {
  const now = new Date();
  const where: any = {
    workspaceId,
    appointmentDate: { gte: dayStart(now), lt: nextDay(now) },
  };
  if (doctorId) where.doctorId = doctorId;

  const q = query.trim();
  if (q) {
    where.OR = [
      { patient: { name: { contains: q, mode: "insensitive" } } },
      { patient: { phone: { contains: q } } },
      ...(/^\d+$/.test(q) ? [{ serialNo: Number(q) }] : []),
    ];
  }

  return prisma.appointment.findMany({
    where,
    orderBy: { serialNo: "asc" },
    include: {
      patient: {
        select: { id: true, name: true, phone: true, age: true, gender: true },
      },
      doctor: { select: { id: true, name: true } },
      chamber: { select: { id: true, name: true } },
    },
  });
};

// ─── List / status ───────────────────────────────────────────────────────────

const listAppointments = async (
  workspaceId: string,
  filters: {
    doctorId?: string;
    patientId?: string;
    from?: Date;
    to?: Date;
    date?: string;
  },
  page: unknown = 1,
  limit: unknown = 20,
) => {
  const { page: pageNum, limit: limitNum, skip } = getPaginationParams(
    page,
    limit,
  );

  const where: any = { workspaceId };
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.date) {
    const d = parseDate(filters.date);
    where.appointmentDate = { gte: dayStart(d), lt: nextDay(d) };
  } else if (filters.from || filters.to) {
    where.appointmentDate = {};
    if (filters.from) where.appointmentDate.gte = filters.from;
    if (filters.to) where.appointmentDate.lte = filters.to;
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: [{ appointmentDate: "desc" }, { serialNo: "asc" }],
      include: {
        patient: {
          select: { id: true, name: true, phone: true, age: true, gender: true },
        },
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

const getAppointment = async (appointmentId: string, workspaceId: string) => {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, workspaceId },
    include: {
      patient: true,
      doctor: { select: { id: true, name: true } },
      chamber: { select: { id: true, name: true } },
      prescriptions: { select: { id: true, serialNumber: true, status: true } },
    },
  });
  if (!appt) throw createAppError("Appointment not found", Status.NOT_FOUND);
  return appt;
};

const updateStatus = async (
  appointmentId: string,
  userId: string,
  workspaceId: string,
  status: AppointmentStatus,
  cancelReason?: string,
) => {
  await checkUserVerification(userId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appt || appt.workspaceId !== workspaceId) {
    throw createAppError("Appointment not found", Status.NOT_FOUND);
  }

  // A paid appointment must be refunded before it can be cancelled.
  if (
    status === AppointmentStatus.CANCELLED &&
    appt.paymentStatus === AppointmentPaymentStatus.PAID
  ) {
    throw createAppError(
      "A paid appointment must be refunded before cancellation",
      Status.BAD_REQUEST,
      true,
      "PAYMENT_REFUND_REQUIRED",
    );
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status,
      cancelReason: cancelReason ?? null,
      ...(status === AppointmentStatus.CANCELLED
        ? { paymentStatus: AppointmentPaymentStatus.CANCELLED }
        : {}),
    },
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.STATUS_CHANGE,
    entityType: AuditEntityType.APPOINTMENT,
    entityId: appointmentId,
    oldValues: { status: appt.status, paymentStatus: appt.paymentStatus },
    newValues: {
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      cancelReason,
    },
  });

  return updated;
};

export const AppointmentService = {
  createAppointment,
  recordPayment,
  searchToday,
  listAppointments,
  getAppointment,
  updateStatus,
};
