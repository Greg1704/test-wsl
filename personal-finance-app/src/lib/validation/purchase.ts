import { z } from "zod";

export const purchaseSchema = z.object({
  cardId: z.cuid(),
  categoryId: z.cuid().optional(),
  description: z.string().min(1, "La descripción es requerida").max(200),
  merchant: z.string().max(100).optional(),
  totalAmount: z.number().positive("El monto debe ser mayor a 0"),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  totalInstallments: z.number().int().min(1).max(60),
  purchaseDate: z.date(),
  interestRateMonthly: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
