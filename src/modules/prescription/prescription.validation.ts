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
  dosagePattern: z.string().optional(), 
  frequency: z.string().optional(), 
  intervalDays: z.number().int().optional(), 
  duration: z.string().min(1, "Duration is required"), 
  quantity: z.number().int().optional(), 
  mealTiming: z
    .enum([
      "BEFORE_MEAL",
      "AFTER_MEAL",
      "WITH_MEAL",
      "AFTER_FULL_MEAL",
      "EMPTY_STOMACH",
    ])
    .optional(),
  instruction: z.string().optional(), 
  notes: z.string().optional(),
  
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


const InvestigationSchema = z.object({
  testName: z.string().min(1, "Test name is required"),
  note: z.string().optional(),
});


const clinicalTextFields = {
  history: z.string().optional(),
  examRespiratoryRate: z.string().optional(),
  examLungs: z.string().optional(),
  examHeart: z.string().optional(),
  examAnaemia: z.string().optional(),
  examCyanosis: z.string().optional(),
  examOedema: z.string().optional(),
  examDehydration: z.string().optional(),
  examOthers: z.string().optional(),
};

const createPrescriptionSchema = z.object({
  body: z.object({
    patientId: z.string().uuid("Invalid Patient ID"),
    
    
    chamberId: z.string().uuid("Invalid Chamber ID").optional(),
    complaints: z.string().optional(),
    diagnosis: z.string().optional(),
    
    bloodPressure: z.string().optional(), 
    pulse: z.string().optional(), 
    temperature: z.string().optional(), 
    weight: z.number().optional(), 
    height: z.string().optional(), 
    respiratoryRate: z.number().int().optional(), 
    clinicalNotes: z.string().optional(),
    advises: z.string().optional(),
    nextVisitDate: z.string().optional(), 
    ...clinicalTextFields,
    
    investigations: z.array(InvestigationSchema).optional(),
    medicines: z
      .array(StructuredMedicineSchema)
      .min(1, "At least one medicine is required"),
    status: z.enum(["DRAFT", "FINALIZED", "CANCELLED"]).optional(),
    
    language: z.nativeEnum(PrescriptionLanguage).optional(),
    template: z.nativeEnum(PrescriptionDesignTemplate).optional(),
    
    appointmentId: z.string().uuid().optional(),
  }),
});

const updatePrescriptionSchema = z.object({
  body: z.object({
    chamberId: z.string().uuid().optional(),
    complaints: z.string().optional(),
    diagnosis: z.string().optional(),
    
    bloodPressure: z.string().optional(),
    pulse: z.string().optional(),
    temperature: z.string().optional(),
    weight: z.number().optional(),
    height: z.string().optional(),
    respiratoryRate: z.number().int().optional(),
    clinicalNotes: z.string().optional(),
    advises: z.string().optional(),
    nextVisitDate: z.string().optional(),
    ...clinicalTextFields,
    
    investigations: z.array(InvestigationSchema).optional(),
    medicines: z.array(StructuredMedicineSchema).optional(),
    status: z.enum(["DRAFT", "FINALIZED", "CANCELLED"]).optional(),
    language: z.nativeEnum(PrescriptionLanguage).optional(),
    template: z.nativeEnum(PrescriptionDesignTemplate).optional(),
  }),
});


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
