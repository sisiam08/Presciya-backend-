import { z } from "zod";

const createSubscriptionSchema = z.object({
  body: z.object({
    subscriptionVariantId: z.string().uuid("Invalid Subscription Variant ID"),
    voucherCode: z.string().optional(),
    paymentMethod: z.string().min(1, "Payment method is required"),
    startDate: z.string().optional(),
  }),
});

const applyVoucherSchema = z.object({
  body: z.object({
    voucherCode: z.string().min(1, "Voucher code is required"),
    subscriptionVariantId: z.string().uuid("Invalid Subscription Variant ID"),
  }),
});

export const SubscriptionValidation = {
  createSubscriptionSchema,
  applyVoucherSchema,
};
