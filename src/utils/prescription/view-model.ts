import config from "../../config";
import { IPdfRenderData } from "../../interface/pdf.type";
import {
  PrescriptionDesignTemplate,
  PrescriptionLanguage,
} from "../../../generated/prisma/enums";
import {
  formatDurationValue,
  formatPrescriptionDate,
  getPrescriptionLabels,
  isBangla,
  localizeDurationText,
  translateMealTiming,
  PrescriptionLabels,
} from "./language";
import { escapeHtml, escapeHtmlMultiline, formatDoctorName, safeUrl } from "./html";

export interface MedicineViewModel {
  index: number;
  brandName: string;
  generic: string;
  strength: string;
  type: string;
  usageType: string;
  dosage: string;
  duration: string;
  mealTimingLabel: string;
  instruction: string;
  notes: string;
}

export interface PrescriptionViewModel {
  language: PrescriptionLanguage;
  template: PrescriptionDesignTemplate;
  labels: PrescriptionLabels;
  isBangla: boolean;

  id: string;
  serialNumber: string;
  verificationCode: string;
  verifyUrl: string;
  qrCodeUrl: string;
  dateStr: string;
  nextVisitStr: string;
  generatedAtStr: string;
  disclaimer: string;
  colorTheme: string;
  showLogo: boolean;

  doctor: {
    name: string;
    qualification: string;
    specialization: string;
    registrationNo: string;
    signature: string;
    bmdcApproved: boolean;
  };
  chamber: {
    name: string;
    slogan: string;
    address: string;
    email: string;
    phones: string;
    logo: string;
  };
  patient: {
    name: string;
    age: string;
    gender: string;
    weight: string;
    identifier: string;
    allergies: string;
    chronicDiseases: string;
  };

  complaints: string;
  diagnosis: string;
  clinicalNotes: string;
  advises: string;
  vitals: {
    bloodPressure: string;
    pulse: string;
    temperature: string;
    height: string;
  };
  hasVitals: boolean;
  hasMedicalHistory: boolean;

  medicines: MedicineViewModel[];
}

const asString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

// Medicine lines arrive either normalised (brandName/…) or as raw
// PrescriptionMedicine rows (snapshotBrandName/…). Accept both so the renderer
// never depends on which layer produced the data.
const readMedicineField = (
  med: Record<string, any>,
  field: "BrandName" | "Generic" | "Strength" | "Type",
): string => {
  const lower = field.charAt(0).toLowerCase() + field.slice(1);
  return asString(med[lower] ?? med[`snapshot${field}`]);
};

// Format the duration from structured (value+unit) or legacy free text, in the
// prescription language (system-generated value, so it is localised).
const formatDuration = (
  med: Record<string, any>,
  language: string | null | undefined,
): string => {
  if (med.durationValue != null && med.durationUnit) {
    return formatDurationValue(
      Number(med.durationValue),
      String(med.durationUnit),
      language,
    );
  }
  return localizeDurationText(asString(med.duration), language);
};

// Build the dosage/instruction line adapted to the instruction type so no
// medicine is forced into a tablet shape (Section 13.1).
const buildDosage = (med: Record<string, any>): string => {
  const usage = med.usageType || "DAILY";

  if (usage === "WEEKLY") {
    const parts = [med.dose || "Apply once"];
    if (med.intervalDays) parts.push(`every ${med.intervalDays} days`);
    return parts.join(" · ");
  }

  if (usage === "TOPICAL") {
    const parts: string[] = [];
    if (med.applicationAmount) parts.push(med.applicationAmount);
    if (med.applicationArea) parts.push(`to ${med.applicationArea}`);
    if (med.applicationFrequency) parts.push(med.applicationFrequency);
    if (med.specificDays) parts.push(med.specificDays);
    if (med.intervalDays) parts.push(`every ${med.intervalDays} days`);
    return parts.join(" · ");
  }

  if (usage === "CUSTOM") {
    const schedule = med.customScheduleJson;
    if (schedule && typeof schedule === "object") {
      return Object.entries(schedule)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ");
    }
    return med.frequency || med.dosagePattern || "";
  }

  // DAILY / STANDARD
  const hasStructuredFrequency =
    med.frequencyMorning != null ||
    med.frequencyNoon != null ||
    med.frequencyNight != null;
  const structured = hasStructuredFrequency
    ? `${med.frequencyMorning ?? 0}+${med.frequencyNoon ?? 0}+${med.frequencyNight ?? 0}`
    : "";
  return structured || med.dosagePattern || med.frequency || "";
};

export const buildPrescriptionViewModel = (
  data: IPdfRenderData,
): PrescriptionViewModel => {
  const {
    id,
    serialNumber,
    verificationCode,
    createdAt,
    complaints,
    diagnosis,
    bloodPressure,
    pulse,
    temperature,
    weight,
    height,
    clinicalNotes,
    advises,
    nextVisitDate,
    medicines,
    doctor,
    chamber,
    patient,
  } = data;

  const language =
    (data.language as PrescriptionLanguage) ?? PrescriptionLanguage.ENGLISH;
  const template =
    (data.template as PrescriptionDesignTemplate) ??
    PrescriptionDesignTemplate.DEFAULT;
  const labels = getPrescriptionLabels(language);

  const dateStr = formatPrescriptionDate(new Date(createdAt), language);

  const nextVisitStr = nextVisitDate
    ? formatPrescriptionDate(new Date(nextVisitDate), language)
    : labels.asNeeded;

  const generatedAtStr = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const phones = chamber?.chamberPhone?.map((p) => p.phone).join(", ") || "N/A";
  const colorTheme = chamber?.templateConfig?.colorTheme || "#0f8374";
  const showLogo = chamber?.templateConfig?.showLogo !== false;

  const disclaimer =
    chamber?.templateConfig?.disclaimer ||
    "This is a digitally generated prescription. Verify authenticity by scanning the QR code.";

  const verifyTarget = verificationCode || id;
  const verifyUrl = `${config.appUrl || "http://localhost:3000"}/verify/prescription/${verifyTarget}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
    verifyUrl,
  )}`;

  const medicineVms: MedicineViewModel[] = (medicines || []).map((med, index) => {
    const usage = (med.usageType || "DAILY") as string;
    const mealLabel =
      med.mealTiming && usage === "DAILY"
        ? translateMealTiming(language, med.mealTiming)
        : "";
    return {
      index: index + 1,
      brandName: escapeHtml(readMedicineField(med, "BrandName")),
      generic: escapeHtml(readMedicineField(med, "Generic")),
      strength: escapeHtml(readMedicineField(med, "Strength")),
      type: escapeHtml(readMedicineField(med, "Type")),
      usageType: usage,
      dosage: escapeHtml(buildDosage(med)),
      duration: escapeHtml(formatDuration(med, language)),
      mealTimingLabel: escapeHtml(mealLabel),
      instruction: escapeHtml(med.instruction),
      notes: escapeHtml(med.notes),
    };
  });

  const vitals = {
    bloodPressure: escapeHtml(bloodPressure),
    pulse: escapeHtml(pulse),
    temperature: escapeHtml(temperature),
    height: escapeHtml(height),
  };

  return {
    language,
    template,
    labels,
    isBangla: isBangla(language),

    id,
    serialNumber: escapeHtml(serialNumber),
    verificationCode: escapeHtml(verificationCode),
    verifyUrl,
    qrCodeUrl,
    dateStr,
    nextVisitStr: escapeHtml(nextVisitStr),
    generatedAtStr: escapeHtml(generatedAtStr),
    disclaimer: escapeHtml(disclaimer),
    colorTheme,
    showLogo,

    doctor: {
      name: escapeHtml(formatDoctorName(doctor.name)),
      qualification: escapeHtml(doctor.qualification),
      specialization: escapeHtml(doctor.specialization),
      registrationNo: escapeHtml(doctor.registrationNo),
      signature: safeUrl(doctor.signature),
      bmdcApproved: Boolean(doctor.bmdcApproved),
    },
    chamber: {
      name: escapeHtml(chamber?.chamberName || "Private Practice"),
      slogan: escapeHtml(chamber?.chamberSlogan),
      address: escapeHtml(chamber?.chamberAddress || "Online Consultation"),
      email: escapeHtml(chamber?.chamberEmail),
      phones: escapeHtml(phones),
      logo: showLogo ? safeUrl(chamber?.logo) : "",
    },
    patient: {
      name: escapeHtml(patient.name),
      age: escapeHtml(patient.age),
      gender: escapeHtml(patient.gender),
      weight: weight ? escapeHtml(weight) : "",
      identifier: escapeHtml(patient.patientIdentifier),
      allergies: escapeHtml(patient.allergies),
      chronicDiseases: escapeHtml(patient.chronicDiseases),
    },

    complaints: escapeHtmlMultiline(complaints),
    diagnosis: escapeHtmlMultiline(diagnosis),
    clinicalNotes: escapeHtmlMultiline(clinicalNotes),
    advises: escapeHtmlMultiline(advises),
    vitals,
    hasVitals: Boolean(
      vitals.bloodPressure || vitals.pulse || vitals.temperature || vitals.height,
    ),
    hasMedicalHistory: Boolean(patient.allergies || patient.chronicDiseases),

    medicines: medicineVms,
  };
};
