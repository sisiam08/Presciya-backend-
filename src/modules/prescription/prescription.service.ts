import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  PrescriptionStatus,
  WorkspaceRole,
  WorkspaceType,
  VerificationStatus,
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { AuditService } from "../audit/audit.service";
import { generatePrescriptionHtml } from "../../utils/pdfGenerator";
import { FeatureServices } from "../feature/feature.service";
import { Workspace } from "../../../generated/prisma/client";
import { checkUserVerification } from "../../utils/verificationCheck";

const createPrescription = async (
  userId: string,
  workspaceId: string,
  prescriptionData: {
    patientId: string;
    chamberId: string; // Required
    complaints?: string;
    diagnosis?: string;
    // Vital signs (moved to ClinicalObservation)
    bloodPressure?: string;
    pulse?: string;
    temperature?: string;
    weight?: number;
    height?: string;
    respiratoryRate?: number;
    clinicalNotes?: string;
    advises?: string;
    nextVisitDate?: string;
    medicines: any[];
    status?: PrescriptionStatus;
  },
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  // 1. Feature access + usage tracking
  // Usage is consumed exactly once by the route middleware; re-validate here
  // without incrementing (incrementBy: 0) so we never double-count.
  await FeatureServices.checkFeatureAccess({
    featureKey: "create_prescription",
    userId,
    workspaceId,
    period: "daily",
    incrementBy: 0,
    trackUsage: false,
  });

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  // BOLA/IDOR: the patient and chamber must belong to the active workspace,
  // never trust client-supplied IDs at face value.
  const patient = await prisma.patient.findFirst({
    where: {
      id: prescriptionData.patientId,
      workspaceId,
      isDeleted: false,
    },
  });

  if (!patient) {
    throw createAppError("Patient not found", Status.NOT_FOUND);
  }

  const chamber = await prisma.chamber.findFirst({
    where: { id: prescriptionData.chamberId, workspaceId },
  });

  if (!chamber) {
    throw createAppError("Chamber not found", Status.NOT_FOUND);
  }

  return await prisma.$transaction(async (tx) => {
    // 2. Create Prescription (without vital signs)
    const prescription = await tx.prescription.create({
      data: {
        doctorUserId: userId,
        patientId: prescriptionData.patientId,
        chamberId: prescriptionData.chamberId,
        workspaceId: workspaceId,
        userId: userId,
        complaints: prescriptionData.complaints || null,
        diagnosis: prescriptionData.diagnosis || null,
        clinicalNotes: prescriptionData.clinicalNotes || null,
        advises: prescriptionData.advises || null,
        nextVisitDate: prescriptionData.nextVisitDate
          ? new Date(prescriptionData.nextVisitDate)
          : null,
        status: prescriptionData.status ?? PrescriptionStatus.DRAFT,
      },
    });

    // 2.5 Create Clinical Observation record (3NF: separate table for vitals)
    if (
      prescriptionData.bloodPressure ||
      prescriptionData.pulse ||
      prescriptionData.temperature ||
      prescriptionData.weight ||
      prescriptionData.height ||
      prescriptionData.respiratoryRate
    ) {
      await tx.clinicalObservation.create({
        data: {
          prescriptionId: prescription.id,
          bloodPressure: prescriptionData.bloodPressure || null,
          pulse: prescriptionData.pulse
            ? parseInt(prescriptionData.pulse)
            : null,
          temperature: prescriptionData.temperature
            ? parseFloat(prescriptionData.temperature)
            : null,
          weight: prescriptionData.weight || null,
          height: prescriptionData.height || null,
          respiratoryRate: prescriptionData.respiratoryRate || null,
        },
      });
    }

    // 3. Create relational medicines mapping
    const medicineRelations = prescriptionData.medicines.map((med: any) =>
      mapMedicineRelation(prescription.id, med),
    );

    await tx.prescriptionMedicine.createMany({
      data: medicineRelations,
    });

    // 4. Update Medicine Favorites frequency metrics
    for (const med of prescriptionData.medicines) {
      if (med.medicineId) {
        await tx.doctorFavoriteMedicine.upsert({
          where: {
            doctorId_medicineId: {
              doctorId: doctor.id,
              medicineId: med.medicineId,
            },
          },
          update: {
            frequencyCount: { increment: 1 },
          },
          create: {
            doctorId: doctor.id,
            medicineId: med.medicineId,
            frequencyCount: 1,
          },
        });
      }
    }

    // Set compiled dynamic print-ready URL
    const appUrl = config.appUrl || `http://localhost:${config.port}`;
    const printUrl = `${appUrl}/api/v1/prescription/${prescription.id}/print`;

    const updatedPrescription = await tx.prescription.update({
      where: { id: prescription.id },
      data: {
        pdfUrl: printUrl,
      },
    });

    // Log Audit Record
    await AuditService.logAudit({
      userId,
      workspaceId,
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.PRESCRIPTION,
      entityId: prescription.id,
      newValues: {
        status: updatedPrescription.status,
        patientId: updatedPrescription.patientId,
        chamberId: updatedPrescription.chamberId,
      },
      metadata: {
        complaints: updatedPrescription.complaints,
        diagnosis: updatedPrescription.diagnosis,
      },
    });

    return updatedPrescription;
  });
};

const getPrescriptionById = async (id: string, workspaceId: string) => {
  // Workspace-scoped lookup: an OWNER of one workspace must never read another
  // workspace's prescription by guessing its ID (Section 6.4).
  const prescription = await prisma.prescription.findFirst({
    where: { id, workspaceId, isDeleted: false },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
      doctor: true,
      chamber: {
        include: { contactNumbers: true },
      },
      patient: true,
    },
  });

  if (!prescription) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  return prescription;
};

const updatePrescription = async (
  id: string,
  userId: string,
  workspaceId: string,
  data: any,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const prescription = await prisma.prescription.findFirst({
    where: { id, workspaceId, isDeleted: false },
  });

  if (!prescription) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  if (prescription.status === PrescriptionStatus.FINALIZED) {
    throw createAppError(
      "Finalized prescriptions cannot be modified. Create a corrected version instead.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  // Finalization must go through finalizePrescription so the verification
  // gate, serial number and verification code are always applied (Section 13.3).
  if (data?.status === PrescriptionStatus.FINALIZED) {
    throw createAppError(
      "Use the finalize endpoint to finalize a prescription.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  return await prisma.$transaction(async (tx) => {
    const { medicines, status, ...rest } = data;

    // 1. Update basic parameters (never pass `medicines` to the Prescription
    //    model — medicine lines live in PrescriptionMedicine).
    const updateData: Record<string, unknown> = { ...rest };
    if (status !== undefined) updateData.status = status;
    if (rest.nextVisitDate) {
      updateData.nextVisitDate = new Date(rest.nextVisitDate);
    }

    const updated = await tx.prescription.update({
      where: { id },
      data: updateData,
    });

    // 2. Refresh relational medicine records if updated
    if (medicines) {
      await tx.prescriptionMedicine.deleteMany({
        where: { prescriptionId: id },
      });

      const medicineRelations = medicines.map((med: any) =>
        mapMedicineRelation(id, med),
      );

      await tx.prescriptionMedicine.createMany({
        data: medicineRelations,
      });
    }

    // Log Audit Record
    await AuditService.logAudit({
      userId,
      workspaceId: prescription.workspaceId,
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.PRESCRIPTION,
      entityId: id,
      oldValues: {
        status: prescription.status,
        diagnosis: prescription.diagnosis,
        complaints: prescription.complaints,
      },
      newValues: {
        status: updated.status,
        diagnosis: updated.diagnosis,
        complaints: updated.complaints,
      },
      metadata: {
        patientId: updated.patientId,
        chamberId: updated.chamberId,
      },
    });

    return updated;
  });
};

const deletePrescription = async (
  id: string,
  userId: string,
  workspaceId: string,
) => {
  // Check if user is verified to perform this action
  await checkUserVerification(userId);

  const prescription = await prisma.prescription.findFirst({
    where: { id, workspaceId, isDeleted: false },
  });

  if (!prescription) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.prescription.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Log Audit Record
    await AuditService.logAudit({
      userId,
      workspaceId: prescription.workspaceId,
      actionType: AuditActionType.DELETE,
      entityType: AuditEntityType.PRESCRIPTION,
      entityId: id,
      oldValues: {
        status: prescription.status,
        isDeleted: prescription.isDeleted,
      },
      newValues: {
        status: deleted.status,
        isDeleted: deleted.isDeleted,
        deletedAt: deleted.deletedAt,
      },
      metadata: {
        deletedReason: "Prescription deleted",
      },
    });
  });
};

const getMyPrescriptions = async (
  userId: string,
  workspaceType: WorkspaceType,
  workspaceId: string,
  filters: { patientPhone?: string; chamberId?: string },
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  // Always scope to the active workspace so prescriptions never leak across
  // workspaces (Section 6.4). A doctor additionally only sees their own.
  let query: any = {
    isDeleted: false,
    workspaceId,
    doctorUserId: userId,
  };

  if (workspaceType === WorkspaceType.PERSONAL) {
    // Personal doctors must have a doctor profile
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      throw createAppError("Doctor profile not found", Status.NOT_FOUND);
    }
  }

  // Filter criteria
  if (filters.chamberId) {
    query.chamberId = filters.chamberId;
  }
  if (filters.patientPhone) {
    query.patient = { phone: filters.patientPhone };
  }

  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where: query,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        patient: { select: { name: true, phone: true } },
        chamber: { select: { name: true } },
      },
    }),
    prisma.prescription.count({ where: query }),
  ]);

  return {
    prescriptions,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const compileHtmlPrescription = async (
  id: string,
  options: { requireFinalized?: boolean } = {},
): Promise<string> => {
  const requireFinalized = options.requireFinalized !== false;

  // Print/download are only permitted for finalized prescriptions (Section
  // 13.3); an authenticated preview may render a draft.
  const prescription = await prisma.prescription.findFirst({
    where: {
      id,
      isDeleted: false,
      ...(requireFinalized && { status: PrescriptionStatus.FINALIZED }),
    },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
      doctor: true, // This is a User relation
      chamber: {
        include: { contactNumbers: true },
      },
      patient: true,
    },
  });

  if (!prescription) {
    throw createAppError(
      "Prescription not found or not finalized. Only finalized prescriptions can be printed.",
      Status.NOT_FOUND,
    );
  }

  // Fetch doctor profile separately since Prescription relates to User, not Doctor
  const doctorProfile = prescription.doctor
    ? await prisma.doctor.findUnique({
        where: { userId: prescription.doctor.id },
      })
    : null;

  // Get latest clinical observation for vitals (3NF: from separate table)
  const latestObservation =
    prescription.clinicalObservations &&
    prescription.clinicalObservations.length > 0
      ? prescription.clinicalObservations[0]
      : null;

  // Structure render data matching IPdfRenderData interface
  const renderData = {
    id: prescription.id,
    serialNumber: prescription.serialNumber || "",
    verificationCode: prescription.verificationCode,
    createdAt: prescription.createdAt,
    status: prescription.status,
    complaints: prescription.complaints,
    diagnosis: prescription.diagnosis,
    // Vitals from ClinicalObservation table
    bloodPressure: latestObservation
      ? latestObservation.bloodPressure || null
      : null,
    pulse: latestObservation ? latestObservation.pulse || null : null,
    temperature: latestObservation
      ? latestObservation.temperature || null
      : null,
    weight: latestObservation ? latestObservation.weight || null : null,
    height: latestObservation ? latestObservation.height || null : null,
    respiratoryRate: latestObservation
      ? latestObservation.respiratoryRate || null
      : null,
    clinicalNotes: prescription.clinicalNotes,
    advises: prescription.advises,
    nextVisitDate: prescription.nextVisitDate,
    medicines: prescription.prescriptionMedicines,
    doctor: {
      name: prescription.doctor?.name || "",
      qualification: doctorProfile?.qualifications || "",
      specialization: doctorProfile?.specialization || "",
      registrationNo: doctorProfile?.bmdcNumber || "",
      signature: doctorProfile?.signatureUrl || "",
      bmdcApproved:
        doctorProfile?.verificationStatus === VerificationStatus.APPROVED,
    },
    chamber: prescription.chamber
      ? {
          chamberName: prescription.chamber.name,
          chamberAddress: prescription.chamber.address || "",
          chamberEmail: prescription.chamber.email,
          logo: prescription.chamber.logo,
          chamberSlogan: prescription.chamber.footerText,
          templateConfig: prescription.chamber.templateConfig,
          chamberPhone:
            prescription.chamber.contactNumbers?.map((cn) => cn.phone) || [],
        }
      : null,
    patient: {
      name: prescription.patient.name,
      age: prescription.patient.age,
      gender: prescription.patient.gender,
      phone: prescription.patient.phone,
      bloodGroup: prescription.patient.bloodGroup,
      allergies: prescription.patient.allergies,
      chronicDiseases: prescription.patient.chronicDiseases,
    },
  };

  return generatePrescriptionHtml(renderData);
};

const generateSerial = (workspaceId: string, seq: number): string => {
  const prefix = workspaceId.slice(0, 4).toUpperCase();
  return `PRS-${prefix}-${String(seq).padStart(6, "0")}`;
};

// Opaque, non-sequential public verification identifier (Section 15).
const generateVerificationCode = (): string =>
  crypto.randomBytes(16).toString("base64url");

/**
 * Maps an incoming medicine payload to a PrescriptionMedicine row. Shared by
 * create and update so both paths persist the same structured fields
 * (Section 13.1) — never duplicate this mapping.
 */
const mapMedicineRelation = (prescriptionId: string, med: any) => ({
  prescriptionId,
  medicineId: med.medicineId || null,
  snapshotBrandName: med.brandName,
  snapshotGeneric: med.generic,
  snapshotStrength: med.strength || null,
  snapshotType: med.type,
  usageType: med.usageType || undefined,
  dosagePattern: med.dosagePattern || null,
  frequency: med.frequency || null,
  intervalDays: med.intervalDays ?? null,
  duration: med.duration || "Not specified",
  mealTiming: med.mealTiming || null,
  instruction: med.instruction || null,
  notes: med.notes || null,
  quantity: med.quantity ?? null,
  dose: med.dose || null,
  frequencyMorning: med.frequencyMorning ?? null,
  frequencyNoon: med.frequencyNoon ?? null,
  frequencyNight: med.frequencyNight ?? null,
  durationValue: med.durationValue ?? null,
  durationUnit: med.durationUnit || null,
  applicationAmount: med.applicationAmount || null,
  applicationArea: med.applicationArea || null,
  applicationFrequency: med.applicationFrequency || null,
  specificDays: med.specificDays || null,
  customScheduleJson: med.customScheduleJson ?? null,
});

// Finalize a draft prescription (locks it, assigns serial number)
const finalizePrescription = async (
  prescriptionId: string,
  userId: string,
  workspaceId: string,
) => {
  // Official prescription generation requires professional verification
  // (Section 7.4). Unverified accounts may not finalize/lock a prescription.
  await checkUserVerification(userId);

  const existing = await prisma.prescription.findUnique({
    where: { id: prescriptionId, isDeleted: false },
    select: { id: true, workspaceId: true, status: true, chamberId: true },
  });

  if (!existing) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  if (existing.workspaceId !== workspaceId) {
    throw createAppError(
      "You do not have permission to finalize this prescription",
      Status.FORBIDDEN,
    );
  }

  if (existing.status === PrescriptionStatus.FINALIZED) {
    throw createAppError(
      "Prescription is already finalized and locked",
      Status.BAD_REQUEST,
    );
  }

  if (existing.status !== PrescriptionStatus.DRAFT) {
    throw createAppError(
      "Only draft prescriptions can be finalized",
      Status.BAD_REQUEST,
    );
  }

  // Assign serial number (unique). Retry on the rare concurrent-collision case.
  let prescription: any = null;
  for (let attempt = 0; attempt < 3 && !prescription; attempt++) {
    try {
      prescription = await prisma.$transaction(async (tx) => {
        const finalizedCount = await tx.prescription.count({
          where: { workspaceId, status: PrescriptionStatus.FINALIZED },
        });

        const serialNumber = generateSerial(
          workspaceId,
          finalizedCount + 1 + attempt,
        );

        return tx.prescription.update({
          where: { id: prescriptionId },
          data: {
            status: PrescriptionStatus.FINALIZED,
            serialNumber,
            verificationCode: generateVerificationCode(),
          },
          include: {
            patient: { select: { name: true, phone: true } },
            chamber: { select: { name: true } },
          },
        });
      });
    } catch (err) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code !== "P2002") throw err;
    }
  }

  if (!prescription) {
    throw createAppError(
      "Failed to finalize prescription. Please try again.",
      Status.INTERNAL_SERVER_ERROR,
    );
  }

  // Audit: Log finalization
  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.STATUS_CHANGE,
    entityType: AuditEntityType.PRESCRIPTION,
    entityId: prescriptionId,
    oldValues: { status: PrescriptionStatus.DRAFT },
    newValues: {
      status: PrescriptionStatus.FINALIZED,
      serialNumber: prescription.serialNumber,
    },
    metadata: {
      patientName: prescription.patient?.name,
      chamberName: prescription.chamber?.name,
    },
  });

  return prescription;
};

const logPrint = async (
  prescriptionId: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string,
) => {
  // Anonymous QR/print views have no authenticated user (and the print log has
  // a FK to User), so only record prints made by an authenticated user.
  if (!userId) return;

  await prisma.prescriptionPrintLog.create({
    data: {
      prescriptionId,
      userId,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
};

const verifyPrescriptionPublic = async (identifier: string) => {
  const baseWhere = {
    isDeleted: false,
    status: PrescriptionStatus.FINALIZED,
  } as const;

  const select = {
    id: true,
    status: true,
    serialNumber: true,
    verificationCode: true,
    createdAt: true,
    nextVisitDate: true,
    doctorUserId: true,
    doctor: { select: { id: true, name: true } },
    chamber: { select: { id: true, name: true } },
  } as const;

  // Prefer the opaque verification code; fall back to the legacy id so older
  // QR codes keep working.
  const prescription =
    (await prisma.prescription.findFirst({
      where: { verificationCode: identifier, ...baseWhere },
      select,
    })) ??
    (await prisma.prescription.findFirst({
      where: { id: identifier, ...baseWhere },
      select,
    }));

  if (!prescription) {
    throw createAppError(
      "No authentic finalized prescription found with this ID.",
      Status.NOT_FOUND,
    );
  }

  // BMDC lives on the Doctor profile, not the User record.
  const doctorProfile = await prisma.doctor.findUnique({
    where: { userId: prescription.doctorUserId },
    select: { bmdcNumber: true },
  });

  // Public endpoint: return only the minimum verification info.
  // Never expose patient identity, contact/clinical data, or medicine details
  // (Section 15).
  return {
    verified: true,
    prescriptionId: prescription.id,
    serialNumber: prescription.serialNumber ?? null,
    issuedAt: prescription.createdAt,
    nextVisitDate: prescription.nextVisitDate,
    doctorName: prescription.doctor?.name ?? "",
    bmdcNumber: doctorProfile?.bmdcNumber ?? null,
    chamberName: prescription.chamber?.name ?? null,
  };
};

/**
 * Authenticated preview of the canonical print layout. Renders drafts as well
 * as finalized prescriptions so the browser preview and the printed output
 * share one renderer (Section 14.4).
 */
const previewPrescription = async (id: string, workspaceId: string) => {
  const prescription = await prisma.prescription.findFirst({
    where: { id, workspaceId, isDeleted: false },
    select: { id: true },
  });

  if (!prescription) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  return compileHtmlPrescription(id, { requireFinalized: false });
};

/**
 * Correction after finalization (Section 13.4). The original finalized record
 * is never mutated — a new DRAFT version is created that supersedes it. The
 * original remains intact and auditable.
 */
const amendPrescription = async (
  prescriptionId: string,
  userId: string,
  workspaceId: string,
) => {
  await checkUserVerification(userId);

  const original = await prisma.prescription.findFirst({
    where: { id: prescriptionId, workspaceId, isDeleted: false },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
    },
  });

  if (!original) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  if (original.status !== PrescriptionStatus.FINALIZED) {
    throw createAppError(
      "Only finalized prescriptions can be amended. Edit the draft instead.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  const revision = await prisma.$transaction(async (tx) => {
    const created = await tx.prescription.create({
      data: {
        workspaceId: original.workspaceId,
        chamberId: original.chamberId,
        doctorUserId: original.doctorUserId,
        patientId: original.patientId,
        userId: original.userId ?? userId,
        status: PrescriptionStatus.DRAFT,
        complaints: original.complaints,
        diagnosis: original.diagnosis,
        clinicalNotes: original.clinicalNotes,
        advises: original.advises,
        nextVisitDate: original.nextVisitDate,
        version: original.version + 1,
        supersedesId: original.id,
      },
    });

    const observation = original.clinicalObservations[0];
    if (observation) {
      await tx.clinicalObservation.create({
        data: {
          prescriptionId: created.id,
          bloodPressure: observation.bloodPressure,
          pulse: observation.pulse,
          temperature: observation.temperature,
          weight: observation.weight,
          height: observation.height,
          respiratoryRate: observation.respiratoryRate,
          notes: observation.notes,
        },
      });
    }

    if (original.prescriptionMedicines.length > 0) {
      await tx.prescriptionMedicine.createMany({
        data: original.prescriptionMedicines.map((m) => ({
          prescriptionId: created.id,
          medicineId: m.medicineId,
          snapshotBrandName: m.snapshotBrandName,
          snapshotGeneric: m.snapshotGeneric,
          snapshotStrength: m.snapshotStrength,
          snapshotType: m.snapshotType,
          usageType: m.usageType,
          dosagePattern: m.dosagePattern,
          frequency: m.frequency,
          intervalDays: m.intervalDays,
          duration: m.duration,
          mealTiming: m.mealTiming,
          instruction: m.instruction,
          notes: m.notes,
          quantity: m.quantity,
          dose: m.dose,
          frequencyMorning: m.frequencyMorning,
          frequencyNoon: m.frequencyNoon,
          frequencyNight: m.frequencyNight,
          durationValue: m.durationValue,
          durationUnit: m.durationUnit,
          applicationAmount: m.applicationAmount,
          applicationArea: m.applicationArea,
          applicationFrequency: m.applicationFrequency,
          specificDays: m.specificDays,
          ...(m.customScheduleJson !== null
            ? { customScheduleJson: m.customScheduleJson as any }
            : {}),
        })),
      });
    }

    return created;
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.PRESCRIPTION,
    entityId: revision.id,
    newValues: {
      status: PrescriptionStatus.DRAFT,
      version: revision.version,
      supersedesId: original.id,
    },
    metadata: {
      amendedFrom: original.id,
      patientId: original.patientId,
    },
  });

  return revision;
};

export const PrescriptionServices = {
  createPrescription,
  getPrescriptionById,
  updatePrescription,
  deletePrescription,
  getMyPrescriptions,
  finalizePrescription,
  compileHtmlPrescription,
  previewPrescription,
  amendPrescription,
  logPrint,
  verifyPrescriptionPublic,
};
