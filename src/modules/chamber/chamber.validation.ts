import { z } from "zod";
import { bangladeshPhone } from "../../utils/phone";

const createChamberSchema = z.object({
  body: z.object({
    chamberName: z.string().min(3, "Chamber name must be at least 3 characters"),
    chamberAddress: z.string().min(5, "Address must be at least 5 characters"),
    chamberEmail: z.string().email("Invalid email").optional(),
    chamberSlogan: z.string().optional(),
    logo: z.string().optional(),
    institutionId: z.string().uuid("Invalid Institution ID").optional(),
    // Each contact number must be a valid Bangladesh mobile (normalised).
    phones: z.array(bangladeshPhone()).optional(),
    templateConfig: z
      .object({
        colorTheme: z.string().optional(),
        headerStyle: z.string().optional(),
        footerStyle: z.string().optional(),
        watermarkUrl: z.string().optional(),
        showLogo: z.boolean().optional(),
      })
      .optional(),
  }),
});

const updateChamberSchema = z.object({
  body: z.object({
    chamberName: z.string().min(3).optional(),
    chamberAddress: z.string().min(5).optional(),
    chamberEmail: z.string().email().optional(),
    chamberSlogan: z.string().optional(),
    logo: z.string().optional(),
    isActive: z.boolean().optional(),
    // Each contact number must be a valid Bangladesh mobile (normalised).
    phones: z.array(bangladeshPhone()).optional(),
    templateConfig: z
      .object({
        colorTheme: z.string().optional(),
        headerStyle: z.string().optional(),
        footerStyle: z.string().optional(),
        watermarkUrl: z.string().optional(),
        showLogo: z.boolean().optional(),
      })
      .optional(),
  }),
});

const addScheduleSchema = z.object({
  body: z.object({
    dayOfWeek: z.enum([
      "SATURDAY",
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
    ]),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
    maxSerials: z.number().int().min(1).default(30),
  }),
});

const createAppointmentSchema = z.object({
  body: z.object({
    doctorId: z.string().uuid("Invalid Doctor ID"),
    patientId: z.string().uuid("Invalid Patient ID"),
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  }),
});

export const ChamberValidation = {
  createChamberSchema,
  updateChamberSchema,
  addScheduleSchema,
  createAppointmentSchema,
};
