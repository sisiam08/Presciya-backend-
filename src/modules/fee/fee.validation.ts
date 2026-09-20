import { z } from "zod";

const money = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine(
    (v) => /^\d{1,12}(\.\d{1,2})?$/.test(v),
    "Amount must be a positive number with up to 2 decimal places",
  )
  .refine((v) => Number(v) >= 0, "Amount cannot be negative");

const upsertFeeSchema = z.object({
  body: z.object({
    visitingFee: money,
    followUpFee: money.optional().nullable(),
  }),
});

export const FeeValidation = {
  upsertFeeSchema,
};
