import { z } from "zod";

const AssignDoctorSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
});

const UpdateDoctorProfileSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    qualification: z.string().optional(),
    specialization: z.string().optional(),
    registrationNo: z.string().min(1, "Registration number is required"),
    signature: z.string().optional(),
  }),
});

export const DoctorValidation = {
  AssignDoctorSchema,
  UpdateDoctorProfileSchema,
};
