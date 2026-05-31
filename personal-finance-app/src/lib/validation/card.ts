import { z } from "zod";

import { parseExpiration, isCardExpired } from "@/server/lib/dates";

const MMYY = /^(0[1-9]|1[0-2])\/\d{2}$/;

export const cardSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  owner: z
    .string()
    .max(100)
    .regex(/^[\p{L}\s]*$/u, "Solo letras")
    .optional(),
  bank: z.string().min(1, "Elegí un banco").max(50),
  brand: z.string().max(50).optional(),
  last4: z
    .string()
    .length(4, "Deben ser 4 dígitos")
    .regex(/^\d{4}$/, "Solo dígitos"),
  // Vencimiento de la tarjeta en formato MM/AA (ej. "08/27"). La conversión a Date
  // se hace en la Server Action, no acá, para no romper el typing de zodResolver.
  expiration: z
    .string()
    .regex(MMYY, "Formato MM/AA (ej. 08/27)")
    // No permitir tarjetas ya vencidas (si el formato es inválido, lo reporta el regex).
    .refine((v) => !MMYY.test(v) || !isCardExpired(parseExpiration(v)), {
      message: "La tarjeta ya está vencida",
    }),
  closingDay: z.number().int().min(1, "Día inválido").max(31, "Día inválido"),
  dueDay: z.number().int().min(1, "Día inválido").max(31, "Día inválido"),
  currency: z.enum(["ARS", "USD"]),
});

export type CardFormValues = z.infer<typeof cardSchema>;
