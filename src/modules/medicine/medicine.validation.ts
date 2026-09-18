import { z } from "zod";

const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().min(1, "Search query must be at least 1 character"),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

const addFavoriteSchema = z.object({
  body: z.object({
    medicineId: z.string().uuid("Invalid Medicine ID"),
  }),
});

export const MedicineValidation = {
  searchQuerySchema,
  addFavoriteSchema,
};
