import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import {
  scopeFilter,
  type RequestScope,
} from "../../utils/chamberScope";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  PrescriptionStatus,
  PrescriptionLanguage,
  PrescriptionDesignTemplate,
  WorkspaceRole,
  WorkspaceType,
  VerificationStatus,
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { AuditService } from "../audit/audit.service";
import { generatePrescriptionHtml } from "../../utils/pdfGenerator";
import { IPdfRenderData } from "../../interface/pdf.type";
import { FeatureServices } from "../feature/feature.service";
import { Workspace } from "../../../generated/prisma/client";
import { checkUserVerification } from "../../utils/verificationCheck";

const createPrescription = async (
  userId: string,
  workspaceId: string,
  prescriptionData: {
    patientId: string;
    chamberId?: string; 
    complaints?: string;
    diagnosis?: string;
    
    bloodPressure?: string;
    pulse?: string;
    temperature?: string;
    weight?: number;
    height?: string;
    respiratoryRate?: number;
    clinicalNotes?: string;
    advises?: string;
    nextVisitDate?: string;
    
    history?: string;
    examRespiratoryRate?: string;
    examLungs?: string;
    examHeart?: string;
    examAnaemia?: string;
    examCyanosis?: string;
    examOedema?: string;
    examDehydration?: string;
    examOthers?: string;
    
    investigations?: Array<{ testName: string; note?: string }>;
    medicines: any[];
    status?: PrescriptionStatus;
    
    language?: PrescriptionLanguage;
    template?: PrescriptionDesignTemplate;
    
    appointmentId?: string;
  },
) => {
  
  await checkUserVerification(userId);

  
  
  
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

  
  
  const language =
    prescriptionData.language ??
    doctor.prescriptionLanguage ??
    PrescriptionLanguage.ENGLISH;
  const template =
    prescriptionData.template ??
    doctor.prescriptionTemplate ??
    PrescriptionDesignTemplate.DEFAULT;

  
  
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

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true },
  });
  const isPersonalWorkspace = workspace?.type === WorkspaceType.PERSONAL;

  
  
  
  
  const chamber = prescriptionData.chamberId
    ? await prisma.chamber.findFirst({
        where: { id: prescriptionData.chamberId, workspaceId },
      })
    : isPersonalWorkspace
      ? null
      : await prisma.chamber.findFirst({ where: { workspaceId } });

  if (prescriptionData.chamberId && !chamber) {
    throw createAppError(
      "Chamber not found in this workspace",
      Status.NOT_FOUND,
    );
  }

  if (!isPersonalWorkspace && !chamber) {
    throw createAppError(
      "No chamber available in this workspace",
      Status.NOT_FOUND,
    );
  }

  
  
  
  
  if (!isPersonalWorkspace) {
    if (!prescriptionData.appointmentId) {
      throw createAppError(
        "An appointment is required to create a prescription in this workspace.",
        Status.BAD_REQUEST,
        true,
        "APPOINTMENT_REQUIRED",
      );
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id: prescriptionData.appointmentId, workspaceId },
      select: {
        id: true,
        doctorId: true,
        patientId: true,
        paymentStatus: true,
      },
    });

    if (!appointment) {
      throw createAppError(
        "Appointment not found in this workspace",
        Status.NOT_FOUND,
      );
    }
    if (appointment.patientId !== prescriptionData.patientId) {
      throw createAppError(
        "Appointment does not belong to this patient",
        Status.BAD_REQUEST,
      );
    }
    if (doctor && appointment.doctorId !== doctor.id) {
      throw createAppError(
        "Appointment belongs to another doctor",
        Status.FORBIDDEN,
      );
    }
    if (
      appointment.paymentStatus !== "PAID" &&
      appointment.paymentStatus !== "FREE"
    ) {
      throw createAppError(
        "Payment is incomplete. Prescription cannot be created until the appointment is paid or marked free.",
        Status.BAD_REQUEST,
        true,
        "PAYMENT_REQUIRED",
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    
    const prescription = await tx.prescription.create({
      data: {
        doctorUserId: userId,
        patientId: prescriptionData.patientId,
        
        chamberId: chamber?.id ?? null,
        workspaceId: workspaceId,
        userId: userId,
        complaints: prescriptionData.complaints || null,
        diagnosis: prescriptionData.diagnosis || null,
        clinicalNotes: prescriptionData.clinicalNotes || null,
        advises: prescriptionData.advises || null,
        
        ...mapClinicalText(prescriptionData),
        nextVisitDate: prescriptionData.nextVisitDate
          ? new Date(prescriptionData.nextVisitDate)
          : null,
        status: prescriptionData.status ?? PrescriptionStatus.DRAFT,
        language,
        template,
        appointmentId: prescriptionData.appointmentId ?? null,
      },
    });

    
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

    
    const medicineRelations = prescriptionData.medicines.map((med: any) =>
      mapMedicineRelation(prescription.id, med),
    );

    await tx.prescriptionMedicine.createMany({
      data: medicineRelations,
    });

    
    await createInvestigations(tx, prescription.id, prescriptionData.investigations);

    
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

    
    const appUrl = config.appUrl || `http://localhost:${config.port}`;
    const printUrl = `${appUrl}/api/v1/prescription/${prescription.id}/print`;

    const updatedPrescription = await tx.prescription.update({
      where: { id: prescription.id },
      data: {
        pdfUrl: printUrl,
      },
    });

    
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

const getPrescriptionById = async (
  id: string,
  workspaceId: string,
  scope?: RequestScope,
) => {
  
  
  const prescription = await prisma.prescription.findFirst({
    where: {
        id,
        ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
        isDeleted: false,
      },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
      investigations: { orderBy: { order: "asc" } },
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
  scope?: RequestScope,
) => {
  
  await checkUserVerification(userId);

  const prescription = await prisma.prescription.findFirst({
    where: {
        id,
        ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
        isDeleted: false,
      },
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

  
  
  if (data?.status === PrescriptionStatus.FINALIZED) {
    throw createAppError(
      "Use the finalize endpoint to finalize a prescription.",
      Status.BAD_REQUEST,
      true,
      "INVALID_STATE",
    );
  }

  return await prisma.$transaction(async (tx) => {
    
    
    const {
      medicines,
      
      investigations,
      status,
      bloodPressure,
      pulse,
      temperature,
      weight,
      height,
      respiratoryRate,
      nextVisitDate,
      ...rest
    } = data;

    
    const updateData: Record<string, unknown> = { ...rest };
    if (status !== undefined) updateData.status = status;
    if (nextVisitDate) {
      updateData.nextVisitDate = new Date(nextVisitDate);
    }

    const updated = await tx.prescription.update({
      where: { id },
      data: updateData,
    });

    
    
    const hasVitals = [
      bloodPressure,
      pulse,
      temperature,
      weight,
      height,
      respiratoryRate,
    ].some((v) => v !== undefined && v !== null && v !== "");

    if (hasVitals) {
      const vitalsData = {
        bloodPressure: bloodPressure ?? null,
        pulse: pulse !== undefined && pulse !== null && pulse !== ""
          ? parseInt(String(pulse), 10) || null
          : null,
        temperature:
          temperature !== undefined && temperature !== null && temperature !== ""
            ? parseFloat(String(temperature)) || null
            : null,
        weight: weight !== undefined && weight !== null ? Number(weight) : null,
        height: height ?? null,
        respiratoryRate:
          respiratoryRate !== undefined && respiratoryRate !== null
            ? Number(respiratoryRate)
            : null,
      };

      const existingObservation = await tx.clinicalObservation.findFirst({
        where: { prescriptionId: id },
        orderBy: { observedAt: "desc" },
        select: { id: true },
      });

      if (existingObservation) {
        await tx.clinicalObservation.update({
          where: { id: existingObservation.id },
          data: vitalsData,
        });
      } else {
        await tx.clinicalObservation.create({
          data: { prescriptionId: id, ...vitalsData },
        });
      }
    }

    
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

    
    if (investigations) {
      await tx.prescriptionInvestigation.deleteMany({
        where: { prescriptionId: id },
      });
      await createInvestigations(tx, id, investigations);
    }

    
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
  scope?: RequestScope,
) => {
  
  await checkUserVerification(userId);

  const prescription = await prisma.prescription.findFirst({
    where: {
        id,
        ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
        isDeleted: false,
      },
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
  filters: { patientPhone?: string; scope?: RequestScope },
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  
  
  let query: any = {
    isDeleted: false,
    workspaceId,
    doctorUserId: userId,
  };

  if (workspaceType === WorkspaceType.PERSONAL) {
    
    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      throw createAppError("Doctor profile not found", Status.NOT_FOUND);
    }
  }

  
  
  
  if (filters.scope) {
    Object.assign(query, scopeFilter(filters.scope));
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
        
        
        prescriptionMedicines: true,
        clinicalObservations: true,
        investigations: { orderBy: { order: "asc" } },
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

  
  
  const prescription = await prisma.prescription.findFirst({
    where: {
      id,
      isDeleted: false,
      ...(requireFinalized && { status: PrescriptionStatus.FINALIZED }),
    },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
      investigations: { orderBy: { order: "asc" } },
      doctor: true, 
      chamber: {
        include: { contactNumbers: true },
      },
      
      
      workspace: { select: { templateConfig: true } },
      patient: true,
    },
  });

  if (!prescription) {
    throw createAppError(
      "Prescription not found or not finalized. Only finalized prescriptions can be printed.",
      Status.NOT_FOUND,
    );
  }

  
  const doctorProfile = prescription.doctor
    ? await prisma.doctor.findUnique({
        where: { userId: prescription.doctor.id },
      })
    : null;

  
  const latestObservation =
    prescription.clinicalObservations &&
    prescription.clinicalObservations.length > 0
      ? prescription.clinicalObservations[0]
      : null;

  
  
  const snapshot = (prescription.renderSnapshot ?? null) as {
    doctor?: IPdfRenderData["doctor"];
    chamber?: IPdfRenderData["chamber"];
    footerText?: string;
    watermark?: IPdfRenderData["watermark"];
  } | null;

  const liveDoctor: IPdfRenderData["doctor"] = {
    name: prescription.doctor?.name || "",
    qualification: doctorProfile?.qualifications || "",
    specialization: doctorProfile?.specialization || "",
    registrationNo: doctorProfile?.bmdcNumber || "",
    signature: doctorProfile?.signatureUrl || "",
    bmdcApproved:
      doctorProfile?.verificationStatus === VerificationStatus.APPROVED,
  };

  const liveChamber: IPdfRenderData["chamber"] = prescription.chamber
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
    : null;

  
  
  
  type PrescriptionSettings = {
    footerText?: string;
    watermarkEnabled?: boolean;
    watermarkText?: string;
    watermarkUrl?: string;
  };
  const activeSettings: PrescriptionSettings = (prescription.chamber
    ? prescription.chamber.templateConfig
    : prescription.workspace?.templateConfig ?? {}) as PrescriptionSettings;

  const footerText = prescription.chamber
    ? prescription.chamber.footerText || activeSettings.footerText || ""
    : activeSettings.footerText || "";

  const configuredWatermark = {
    enabled: Boolean(activeSettings.watermarkEnabled),
    text: activeSettings.watermarkText || "",
    url: activeSettings.watermarkUrl || "",
  };

  
  
  const watermarkAllowed =
    configuredWatermark.enabled &&
    (await FeatureServices.isFeatureAllowed({
      userId: prescription.doctorUserId,
      workspaceId: prescription.workspaceId,
      featureKey: "watermark",
    }));

  const watermark = watermarkAllowed
    ? configuredWatermark
    : { enabled: false, text: "", url: "" };

  
  
  
  
  const qrVerificationAllowed = await FeatureServices.isFeatureAllowed({
    userId: prescription.doctorUserId,
    workspaceId: prescription.workspaceId,
    featureKey: "qr_verification",
  });

  
  const renderData: IPdfRenderData = {
    id: prescription.id,
    serialNumber: prescription.serialNumber || "",
    verificationCode: prescription.verificationCode,
    qrVerificationAllowed,
    createdAt: prescription.createdAt,
    status: prescription.status,
    language: prescription.language,
    template: prescription.template,
    complaints: prescription.complaints,
    diagnosis: prescription.diagnosis,
    
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
    
    history: prescription.history,
    examRespiratoryRate: prescription.examRespiratoryRate,
    examLungs: prescription.examLungs,
    examHeart: prescription.examHeart,
    examAnaemia: prescription.examAnaemia,
    examCyanosis: prescription.examCyanosis,
    examOedema: prescription.examOedema,
    examDehydration: prescription.examDehydration,
    examOthers: prescription.examOthers,
    investigations: prescription.investigations.map((inv) => ({
      testName: inv.testName,
      note: inv.note,
    })),
    
    
    
    medicines: prescription.prescriptionMedicines.map(toRenderMedicine),
    doctor: snapshot?.doctor ?? liveDoctor,
    chamber: snapshot?.chamber ?? liveChamber,
    
    footerText: snapshot?.footerText ?? footerText,
    watermark: snapshot?.watermark ?? watermark,
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


const generateVerificationCode = (): string =>
  crypto.randomBytes(16).toString("base64url");


const CLINICAL_TEXT_KEYS = [
  "history",
  "examRespiratoryRate",
  "examLungs",
  "examHeart",
  "examAnaemia",
  "examCyanosis",
  "examOedema",
  "examDehydration",
  "examOthers",
] as const;


const mapClinicalText = (data: Record<string, any>) => {
  const mapped: Record<string, string | null> = {};
  for (const key of CLINICAL_TEXT_KEYS) {
    if (data[key] !== undefined) mapped[key] = data[key]?.trim() || null;
  }
  return mapped;
};


const createInvestigations = async (
  tx: any,
  prescriptionId: string,
  investigations?: Array<{ testName?: string; note?: string | undefined }>,
) => {
  if (!investigations?.length) return;

  const rows = investigations
    .filter((inv) => inv?.testName?.trim())
    .map((inv, index) => ({
      prescriptionId,
      testName: inv.testName!.trim(),
      note: inv.note?.trim() || null,
      order: index,
    }));

  if (rows.length > 0) {
    await tx.prescriptionInvestigation.createMany({ data: rows });
  }
};


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


const toRenderMedicine = (m: any) => ({
  medicineId: m.medicineId,
  brandName: m.snapshotBrandName,
  generic: m.snapshotGeneric,
  strength: m.snapshotStrength,
  type: m.snapshotType,
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
  customScheduleJson: m.customScheduleJson,
});


const finalizePrescription = async (
  prescriptionId: string,
  userId: string,
  workspaceId: string,
) => {
  
  
  await checkUserVerification(userId);

  const existing = await prisma.prescription.findUnique({
    where: { id: prescriptionId, isDeleted: false },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      chamberId: true,
      doctorUserId: true,
    },
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

  
  
  const [creator, doctorProfile, chamber, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: existing.doctorUserId },
      select: { name: true },
    }),
    prisma.doctor.findUnique({ where: { userId: existing.doctorUserId } }),
    
    existing.chamberId
      ? prisma.chamber.findUnique({
          where: { id: existing.chamberId },
          include: { contactNumbers: true },
        })
      : Promise.resolve(null),
    
    prisma.workspace.findUnique({
      where: { id: existing.workspaceId },
      select: { templateConfig: true },
    }),
  ]);

  
  
  const frozenSettings = ((chamber?.templateConfig ??
    workspace?.templateConfig ??
    {}) as Record<string, unknown>) as {
    footerText?: string;
    watermarkEnabled?: boolean;
    watermarkText?: string;
    watermarkUrl?: string;
  };
  const frozenFooterText = chamber
    ? chamber.footerText || frozenSettings.footerText || ""
    : frozenSettings.footerText || "";

  const renderSnapshot = {
    doctor: {
      name: creator?.name || doctorProfile?.name || "",
      qualification: doctorProfile?.qualifications || "",
      specialization: doctorProfile?.specialization || "",
      registrationNo: doctorProfile?.bmdcNumber || "",
      signature: doctorProfile?.signatureUrl || "",
      bmdcApproved:
        doctorProfile?.verificationStatus === VerificationStatus.APPROVED,
    },
    chamber: chamber
      ? {
          chamberName: chamber.name,
          chamberAddress: chamber.address || "",
          chamberEmail: chamber.email,
          logo: chamber.logo,
          chamberSlogan: chamber.footerText,
          templateConfig: chamber.templateConfig,
          chamberPhone:
            chamber.contactNumbers?.map((cn) => cn.phone) || [],
        }
      : null,
    footerText: frozenFooterText,
    watermark: {
      enabled: Boolean(frozenSettings.watermarkEnabled),
      text: frozenSettings.watermarkText || "",
      url: frozenSettings.watermarkUrl || "",
    },
  };

  
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
            renderSnapshot: renderSnapshot as any,
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

  
  const doctorProfile = await prisma.doctor.findUnique({
    where: { userId: prescription.doctorUserId },
    select: { bmdcNumber: true },
  });

  
  
  
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


const previewPrescription = async (
  id: string,
  workspaceId: string,
  scope?: RequestScope,
) => {
  const prescription = await prisma.prescription.findFirst({
    where: {
        id,
        ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
        isDeleted: false,
      },
    select: { id: true },
  });

  if (!prescription) {
    throw createAppError("Prescription not found", Status.NOT_FOUND);
  }

  return compileHtmlPrescription(id, { requireFinalized: false });
};


const amendPrescription = async (
  prescriptionId: string,
  userId: string,
  workspaceId: string,
  scope?: RequestScope,
) => {
  await checkUserVerification(userId);

  const original = await prisma.prescription.findFirst({
    where: {
        id: prescriptionId,
        ...(scope ? (scopeFilter(scope) as any) : { workspaceId }),
        isDeleted: false,
      },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
      investigations: { orderBy: { order: "asc" } },
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
        
        history: original.history,
        examRespiratoryRate: original.examRespiratoryRate,
        examLungs: original.examLungs,
        examHeart: original.examHeart,
        examAnaemia: original.examAnaemia,
        examCyanosis: original.examCyanosis,
        examOedema: original.examOedema,
        examDehydration: original.examDehydration,
        examOthers: original.examOthers,
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

    
    await createInvestigations(
      tx,
      created.id,
      original.investigations.map((inv) => ({
        testName: inv.testName,
        note: inv.note ?? undefined,
      })),
    );

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

  
  
  const fullRevision = await prisma.prescription.findUnique({
    where: { id: revision.id },
    include: {
      prescriptionMedicines: true,
      clinicalObservations: true,
      investigations: { orderBy: { order: "asc" } },
    },
  });

  return fullRevision ?? revision;
};


const previewTemplateSample = async (
  userId: string,
  workspaceId: string,
  template: PrescriptionDesignTemplate,
  language: PrescriptionLanguage,
  
  chamberId?: string | null,
): Promise<string> => {
  const [user, doctorProfile, chamber, workspace] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.doctor.findUnique({ where: { userId } }),
    chamberId
      ? prisma.chamber.findFirst({
          where: { id: chamberId, workspaceId },
          include: { contactNumbers: true },
        })
      : Promise.resolve(null),
    
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { templateConfig: true },
    }),
  ]);

  
  
  
  
  const isBn = language === PrescriptionLanguage.BANGLA;
  const sample = isBn
    ? {
        complaints: "তিন দিন ধরে জ্বর ও মাথাব্যথা",
        diagnosis: "তীব্র ভাইরাল জ্বর",
        clinicalNotes: "প্রচুর পানি পান করুন এবং সম্পূর্ণ বিশ্রাম নিন।",
        advises: "কোর্সটি সম্পূর্ণ করুন। তিন দিনের বেশি জ্বর থাকলে পুনরায় আসুন।",
        instruction: "খাবারের পরে পানি দিয়ে খান।",
        allergies: "কোনোটি নয়",
        chronicDiseases: "কোনোটি নয়",
      }
    : {
        complaints: "Fever and headache for 3 days",
        diagnosis: "Acute viral fever",
        clinicalNotes: "Drink plenty of water and take complete rest.",
        advises:
          "Complete the full course. Return if the fever persists beyond 3 days.",
        instruction: "Take after meals with plenty of water.",
        allergies: "None known",
        chronicDiseases: "None",
      };

  
  
  
  
  
  type BrandingSettings = {
    footerText?: string;
    watermarkEnabled?: boolean;
    watermarkText?: string;
    watermarkUrl?: string;
  };
  const activeSettings: BrandingSettings = (chamber
    ? chamber.templateConfig
    : workspace?.templateConfig ?? {}) as BrandingSettings;

  const previewFooterText = chamber
    ? chamber.footerText || activeSettings.footerText || ""
    : activeSettings.footerText || "";

  const configuredWatermark = {
    enabled: Boolean(activeSettings.watermarkEnabled),
    text: activeSettings.watermarkText || "",
    url: activeSettings.watermarkUrl || "",
  };
  const previewWatermarkAllowed =
    configuredWatermark.enabled &&
    (await FeatureServices.isFeatureAllowed({
      userId,
      workspaceId,
      featureKey: "watermark",
    }));
  const previewWatermark = previewWatermarkAllowed
    ? configuredWatermark
    : { enabled: false, text: "", url: "" };

  
  const previewQrAllowed = await FeatureServices.isFeatureAllowed({
    userId,
    workspaceId,
    featureKey: "qr_verification",
  });

  const renderData: IPdfRenderData = {
    id: "SAMPLE-PRESCRIPTION",
    serialNumber: "PRS-SAMPLE-000001",
    verificationCode: "sample-verification-code",
    createdAt: new Date(),
    status: "FINALIZED",
    language,
    template,
    complaints: sample.complaints,
    diagnosis: sample.diagnosis,
    bloodPressure: "120/80",
    pulse: 82,
    temperature: 101.2,
    weight: 68,
    height: "172 cm",
    clinicalNotes: sample.clinicalNotes,
    advises: sample.advises,
    nextVisitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    medicines: [
      {
        brandName: "Napa",
        generic: "Paracetamol",
        strength: "500 mg",
        type: "Tablet",
        usageType: "DAILY",
        dosagePattern: "1+0+1",
        mealTiming: "AFTER_MEAL",
        duration: "7 days",
        instruction: sample.instruction,
      },
      {
        brandName: "Seclo",
        generic: "Omeprazole",
        strength: "20 mg",
        type: "Capsule",
        usageType: "DAILY",
        dosagePattern: "1+0+0",
        mealTiming: "BEFORE_MEAL",
        duration: "7 days",
      },
      {
        brandName: "Monas",
        generic: "Montelukast",
        strength: "10 mg",
        type: "Tablet",
        usageType: "DAILY",
        dosagePattern: "0+0+1",
        mealTiming: "AFTER_MEAL",
        duration: "14 days",
      },
    ],
    doctor: {
      name: user?.name || doctorProfile?.name || "Dr. Sample",
      qualification: doctorProfile?.qualifications || "MBBS, FCPS (Medicine)",
      specialization: doctorProfile?.specialization || "Internal Medicine",
      registrationNo: doctorProfile?.bmdcNumber || "A-123456",
      signature: doctorProfile?.signatureUrl || null,
      bmdcApproved:
        doctorProfile?.verificationStatus === VerificationStatus.APPROVED,
    },
    chamber: chamber
      ? {
          chamberName: chamber.name,
          chamberAddress: chamber.address || "Dhaka, Bangladesh",
          chamberEmail: chamber.email,
          logo: chamber.logo,
          chamberSlogan: chamber.footerText,
          templateConfig: chamber.templateConfig,
          chamberPhone: chamber.contactNumbers?.map((cn) => cn.phone) || [],
        }
      : {
          chamberName: "Presciya Sample Chamber",
          chamberAddress: "Dhanmondi, Dhaka",
          chamberEmail: null,
          logo: null,
          chamberSlogan: "Caring for you",
          templateConfig: null,
          chamberPhone: [{ phone: "+880 1700-000000" }],
        },
    patient: {
      
      name: "Md. Rahim Uddin",
      age: 35,
      gender: "MALE",
      phone: "01711111111",
      bloodGroup: "B+",
      allergies: sample.allergies,
      chronicDiseases: sample.chronicDiseases,
      patientIdentifier: "P-000123",
    },
    footerText: previewFooterText,
    watermark: previewWatermark,
    qrVerificationAllowed: previewQrAllowed,
  };

  return generatePrescriptionHtml(renderData);
};

export const PrescriptionServices = {
  createPrescription,
  previewTemplateSample,
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
