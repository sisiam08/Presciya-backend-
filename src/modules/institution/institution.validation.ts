import { z } from "zod";
import { optionalBangladeshPhone } from "../../utils/phone";

const createInstitutionSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Institution name must be at least 3 characters"),
    legalName: z.string().min(3).optional(),
    address: z.string().min(5, "Address must be at least 5 characters"),
    phone: optionalBangladeshPhone(),
    email: z.string().email("Invalid email").optional(),
    website: z.string().url("Invalid website URL").optional(),
    slogan: z.string().optional(),
    logo: z.string().optional(),
    description: z.string().optional(),
    tradeLicenseNo: z.string().optional(),
    registrationNumber: z.string().optional(),
  }),
});

const updateInstitutionSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    legalName: z.string().min(3).optional(),
    address: z.string().min(5).optional(),
    phone: optionalBangladeshPhone(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    slogan: z.string().optional(),
    logo: z.string().optional(),
    description: z.string().optional(),
    tradeLicenseNo: z.string().optional(),
    registrationNumber: z.string().optional(),
    isVerified: z.boolean().optional(),
  }),
});

const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Department name must be at least 2 characters"),
    description: z.string().optional(),
  }),
});

const assignDoctorSchema = z.object({
  body: z
    .object({
      // Either assign an existing doctor record by id, or invite by email
      // (existing or new user; never creates a duplicate User).
      doctorId: z.string().uuid("Invalid Doctor ID").optional(),
      email: z.string().email("Invalid email address").optional(),
      name: z.string().min(2).optional(),
      dummyPassword: z.string().min(8).optional(),
      departmentId: z.string().optional(),
      chamberIds: z.array(z.string().uuid("Invalid Chamber ID")).optional(),
    })
    .refine((d) => Boolean(d.doctorId || d.email), {
      message: "Provide a doctorId or an email address",
      path: ["doctorId"],
    }),
});

const updateBrandingSchema = z.object({
  body: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    fontFamily: z.string().optional(),
    headerTemplate: z.string().optional(),
    footerTemplate: z.string().optional(),
    showLogo: z.boolean().optional(),
  }),
});

export const InstitutionValidation = {
  createInstitutionSchema,
  updateInstitutionSchema,
  createDepartmentSchema,
  assignDoctorSchema,
  updateBrandingSchema,
};
