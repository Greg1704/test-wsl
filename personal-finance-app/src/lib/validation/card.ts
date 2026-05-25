import { z } from "zod";

export const cardSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  brand: z.string().max(50).optional(),
  last4: z
    .string()
    .length(4, "Deben ser exactamente 4 dígitos")
    .regex(/^\d{4}$/, "Solo dígitos")
    .optional(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
});

export type CardFormValues = z.infer<typeof cardSchema>;
