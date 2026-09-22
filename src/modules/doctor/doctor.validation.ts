import { z } from "zod";
import { bangladeshPhone } from "../../utils/phone";
import {
  ContactLabel,
  PrescriptionLanguage,
  PrescriptionDesignTemplate,
} from "../../../generated/prisma/enums";
import config from "../../config";

const AssignDoctorSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    email: z.string().email("Invalid email address"),
    dummyPassword: z.string().min(8, "Password must be at least 8 characters long"),
    // dummyPassword: z.string().regex(config.regex.passwordRegex, "Invalid password"),
    departmentId: z.string(),
  }),
});

const UpdateDoctorProfileSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Name must be at least 3 characters long")
      .optional(),
    phone: z
      .array(
        z.object({
          userId: z.string().optional(),
          chamberId: z.string().optional(),
          label: z.nativeEnum(ContactLabel, "Contact label is required"),
          // Shared Bangladesh rule (accepts +880…/separators, normalises).
          phone: bangladeshPhone("Invalid phone number"),
          isPrimary: z.boolean().optional(),
        }),
      )
      .optional(),
    image: z.string().optional(),
    qualification: z.string().optional(),
    specialization: z.string().optional(),
    designation: z.string().optional(),
    registrationNo: z
      .string()
      .min(1, "Registration number is required")
      // BMDC numbers vary in length; accept an optional dash and 4-7 digits.
      .regex(/^A-?\d{4,7}$/i, "Registration number must be like A-123456")
      .optional(),
    signature: z.string().optional(),
    // Prescription rendering defaults (Settings → Prescription).
    prescriptionLanguage: z.nativeEnum(PrescriptionLanguage).optional(),
    prescriptionTemplate: z.nativeEnum(PrescriptionDesignTemplate).optional(),
  }),
});

export const DoctorValidation = {
  AssignDoctorSchema,
  UpdateDoctorProfileSchema,
};
