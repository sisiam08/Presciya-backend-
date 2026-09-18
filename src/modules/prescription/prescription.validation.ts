import { z } from "zod";

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
});

const createPrescriptionSchema = z.object({
  body: z.object({
    patientId: z.string().uuid("Invalid Patient ID"),
    chamberId: z.string().uuid("Invalid Chamber ID"),
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
  }),
});

export const PrescriptionValidation = {
  createPrescriptionSchema,
  updatePrescriptionSchema,
};
