import { z } from "zod";

const createInstitutionSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Institution name must be at least 3 characters"),
    legalName: z.string().min(3).optional(),
    address: z.string().min(5, "Address must be at least 5 characters"),
    phone: z.string().optional(),
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
    phone: z.string().optional(),
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
  body: z.object({
    doctorId: z.string().uuid("Invalid Doctor ID"),
    departmentId: z.string().uuid("Invalid Department ID").optional(),
    chamberIds: z.array(z.string().uuid("Invalid Chamber ID")).optional(),
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
