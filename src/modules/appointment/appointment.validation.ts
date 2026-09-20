import { z } from "zod";
import {
  AppointmentType,
  PaymentMethod,
} from "../../../generated/prisma/enums";

const money = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine(
    (v) => /^\d{1,12}(\.\d{1,2})?$/.test(v),
    "Amount must be a positive number with up to 2 decimal places",
  );

const createAppointmentSchema = z.object({
  body: z.object({
    patientId: z.string().uuid("Invalid Patient ID"),
    doctorId: z.string().uuid("Invalid Doctor ID").optional(),
    chamberId: z.string().uuid("Invalid Chamber ID").optional(),
    appointmentDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
      message: "Invalid date",
    }),
    notes: z.string().max(1000).optional(),
    appointmentType: z.nativeEnum(AppointmentType).optional(),
    discount: money.optional(),
    // Optional immediate settlement.
    paymentStatus: z.enum(["PENDING", "PAID", "FREE"]).optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paidAmount: money.optional(),
    followUpOfId: z.string().uuid().optional(),
  }),
});

const recordPaymentSchema = z.object({
  body: z.object({
    paidAmount: money.optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    discount: money.optional(),
    markFree: z.boolean().optional(),
  }),
});

const searchAppointmentsSchema = z.object({
  query: z.object({
    q: z.string().max(200).optional(),
    doctorId: z.string().uuid().optional(),
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
    cancelReason: z.string().max(500).optional(),
  }),
});

export const AppointmentValidation = {
  createAppointmentSchema,
  recordPaymentSchema,
  searchAppointmentsSchema,
  updateAppointmentStatusSchema,
};
