import { z } from "zod";
import {
  PrescriptionLanguage,
  PrescriptionDesignTemplate,
} from "../../../generated/prisma/enums";

const StructuredMedicineSchema = z.object({
  medicineId: z.string().uuid().optional(),
  brandName: z.string().min(1, "Brand name is required"),
  generic: z.string().min(1, "Generic name is required"),
  strength: z.string().optional(),
  type: z.string().min(1, "Medicine type (e.g. tablet, capsule) is required"),
  usageType: z.enum(["DAILY", "TOPICAL", "WEEKLY", "CUSTOM"]),
  dosagePattern: z.string().optional(), // e.g. "1+0+1" - context-specific dosage
  frequency: z.string().optional(), // e.g. "3 times daily"
  intervalDays: z.number().int().optional(), // For weekly
  duration: z.string().min(1, "Duration is required"), // e.g. "7 days" - required
  quantity: z.number().int().optional(), // Number of units
  mealTiming: z
    .enum([
      "BEFORE_MEAL",
      "AFTER_MEAL",
      "WITH_MEAL",
      "AFTER_FULL_MEAL",
      "EMPTY_STOMACH",
    ])
    .optional(),
  instruction: z.string().optional(), // e.g. "খাবারের ১০ মিনিট আগে খাবেন"
  notes: z.string().optional(),
  // Structured instruction fields (Section 13.1)
  dose: z.string().optional(),
  frequencyMorning: z.number().int().min(0).optional(),
  frequencyNoon: z.number().int().min(0).optional(),
  frequencyNight: z.number().int().min(0).optional(),
  durationValue: z.number().int().min(0).optional(),
  durationUnit: z.enum(["day", "week", "month"]).optional(),
  applicationAmount: z.string().optional(),
  applicationArea: z.string().optional(),
  applicationFrequency: z.string().optional(),
  specificDays: z.string().optional(),
  customScheduleJson: z.record(z.string(), z.any()).optional(),
});

const createPrescriptionSchema = z.object({
  body: z.object({
    patientId: z.string().uuid("Invalid Patient ID"),
    // Optional: chamber workspaces have no separate chamber row; the service
    // falls back to the workspace's first chamber.
    chamberId: z.string().uuid("Invalid Chamber ID").optional(),
    complaints: z.string().optional(),
    diagnosis: z.string().optional(),
    // Clinical Vitals (moved to ClinicalObservation table)
    bloodPressure: z.string().optional(), // e.g., "120/80"
    pulse: z.string().optional(), // beats per minute
    temperature: z.string().optional(), // in Celsius
    weight: z.number().optional(), // in kg
    height: z.string().optional(), // e.g., "170 cm"
    respiratoryRate: z.number().int().optional(), // breaths per minute
    clinicalNotes: z.string().optional(),
    advises: z.string().optional(),
    nextVisitDate: z.string().optional(), // YYYY-MM-DD
    medicines: z
      .array(StructuredMedicineSchema)
      .min(1, "At least one medicine is required"),
    status: z.enum(["DRAFT", "FINALIZED", "CANCELLED"]).optional(),
    // Rendering choices. Never trust arbitrary strings — only known enum values.
    language: z.nativeEnum(PrescriptionLanguage).optional(),
    template: z.nativeEnum(PrescriptionDesignTemplate).optional(),
    // The eligible visit (required in chamber/institution context).
    appointmentId: z.string().uuid().optional(),
  }),
});

const updatePrescriptionSchema = z.object({
  body: z.object({
    chamberId: z.string().uuid().optional(),
    complaints: z.string().optional(),
    diagnosis: z.string().optional(),
    // Clinical Vitals (moved to ClinicalObservation table)
    bloodPressure: z.string().optional(),
    pulse: z.string().optional(),
    temperature: z.string().optional(),
    weight: z.number().optional(),
    height: z.string().optional(),
    respiratoryRate: z.number().int().optional(),
    clinicalNotes: z.string().optional(),
    advises: z.string().optional(),
    nextVisitDate: z.string().optional(),
    medicines: z.array(StructuredMedicineSchema).optional(),
    status: z.enum(["DRAFT", "FINALIZED", "CANCELLED"]).optional(),
    language: z.nativeEnum(PrescriptionLanguage).optional(),
    template: z.nativeEnum(PrescriptionDesignTemplate).optional(),
  }),
});

// Settings template picker: render a sample for a specific template + language.
const previewTemplateSampleSchema = z.object({
  query: z.object({
    template: z.nativeEnum(PrescriptionDesignTemplate),
    language: z.nativeEnum(PrescriptionLanguage).optional(),
  }),
});

export const PrescriptionValidation = {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  previewTemplateSampleSchema,
};
