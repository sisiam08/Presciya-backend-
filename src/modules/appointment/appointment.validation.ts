import { z } from "zod";

const createAppointmentSchema = z.object({
  body: z.object({
    chamberId: z.string().uuid("Invalid Chamber ID"),
    doctorId: z.string().uuid("Invalid Doctor ID"),
    patientId: z.string().uuid("Invalid Patient ID"),
    appointmentDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
      message: "Invalid date",
    }),
    notes: z.string().optional(),
  }),
});

const updateAppointmentStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "RUNNING",
      "PENDING",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ]),
    cancelReason: z.string().optional(),
  }),
});

export const AppointmentValidation = {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
};
