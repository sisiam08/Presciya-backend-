import { z } from "zod";

const percentage = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v), "Percentage must be a number")
  .refine((v) => v >= 0, "Percentage cannot be negative")
  .refine((v) => v <= 100, "Percentage cannot exceed 100");

const setDefaultSchema = z.object({
  body: z.object({ percentage }),
});

const setOverrideSchema = z.object({
  body: z.object({ percentage }),
});

export const RevenueValidation = {
  setDefaultSchema,
  setOverrideSchema,
};
