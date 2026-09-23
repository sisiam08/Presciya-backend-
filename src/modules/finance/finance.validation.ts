import { z } from "zod";
import {
  FinancialTransactionType,
  PaymentMethod,
} from "../../../generated/prisma/enums";

// Amount is accepted as a number or string and normalised to a decimal string.
// Never coerced to a float — the service hands the string straight to Prisma's
// Decimal column so precision is preserved.
const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine(
    (v) => /^\d{1,12}(\.\d{1,2})?$/.test(v),
    "Amount must be a positive number with up to 2 decimal places",
  )
  .refine((v) => Number(v) > 0, "Amount must be greater than 0");

const scopeSchema = z.enum(["workspace", "all"]);
const periodSchema = z.enum([
  "today",
  "week",
  "month",
  "year",
  "all",
  "custom",
]);
const groupBySchema = z.enum(["day", "week", "month", "year"]);

const optionalUuid = z.string().uuid().optional();
const nullableUuid = z.string().uuid().nullable().optional();

// No `createTransactionSchema`: manual transaction creation was removed (see
// finance.router.ts). `updateTransactionSchema` below still governs corrections.

const updateTransactionSchema = z.object({
  body: z.object({
    type: z.nativeEnum(FinancialTransactionType).optional(),
    amount: amountSchema.optional(),
    categoryId: z.string().uuid().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    description: z.string().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    transactionDate: z.string().min(1).optional(),
    patientId: nullableUuid,
    appointmentId: nullableUuid,
    prescriptionId: nullableUuid,
  }),
});

const listTransactionsSchema = z.object({
  query: z.object({
    scope: scopeSchema.optional(),
    workspaceId: optionalUuid,
    type: z.nativeEnum(FinancialTransactionType).optional(),
    categoryId: optionalUuid,
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    period: periodSchema.optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const summaryQuerySchema = z.object({
  query: z.object({
    scope: scopeSchema.optional(),
    workspaceId: optionalUuid,
    period: periodSchema.optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

const reportQuerySchema = z.object({
  query: z.object({
    scope: scopeSchema.optional(),
    workspaceId: optionalUuid,
    period: periodSchema.optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    groupBy: groupBySchema.optional(),
  }),
});

const listCategoriesSchema = z.object({
  query: z.object({
    type: z.nativeEnum(FinancialTransactionType).optional(),
    includeInactive: z
      .union([z.literal("true"), z.literal("false")])
      .optional(),
  }),
});

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    type: z.nativeEnum(FinancialTransactionType),
    description: z.string().max(500).optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const FinanceValidation = {
  updateTransactionSchema,
  listTransactionsSchema,
  summaryQuerySchema,
  reportQuerySchema,
  listCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
};
