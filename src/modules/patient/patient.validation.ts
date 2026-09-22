import { z } from "zod";
import { optionalBangladeshPhone } from "../../utils/phone";

const createPatientSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Patient name must be at least 2 characters"),
    age: z.number().int().min(0, "Age must be a positive integer"),
    gender: z.enum(["MALE", "FEMALE"]),
    weight: z.number().min(0).optional(),
    phone: optionalBangladeshPhone(),
    address: z.string().optional(),
    bloodGroup: z
      .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
      .optional(),
    allergies: z.string().optional(),
    chronicDiseases: z.string().optional(),
    emergencyContact: optionalBangladeshPhone(),
    patientNotes: z.string().optional(),
  }),
});

const updatePatientSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    age: z.number().int().min(0).optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    weight: z.number().min(0).optional(),
    phone: optionalBangladeshPhone(),
    address: z.string().optional(),
    bloodGroup: z
      .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
      .optional(),
    allergies: z.string().optional(),
    chronicDiseases: z.string().optional(),
    emergencyContact: optionalBangladeshPhone(),
    patientNotes: z.string().optional(),
    isDeleted: z.boolean().optional(),
  }),
});

export const PatientValidation = {
  createPatientSchema,
  updatePatientSchema,
};
