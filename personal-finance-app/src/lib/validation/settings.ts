import { z } from "zod";

/**
 * Configuración del usuario: moneda principal + ingreso mensual por moneda (RF-5.1,
 * RF-ahorros). El ingreso es fechado por vigencia (modelo `IncomeEntry`): guardarlo
 * inserta/actualiza la entrada del mes actual; los meses pasados conservan su valor.
 * Cada moneda es opcional (un usuario puede tener ingreso solo en una).
 */
export const incomeSchema = z.object({
  defaultCurrency: z.enum(["ARS", "USD"]),
  incomeArs: z.number().nonnegative("El ingreso no puede ser negativo").optional(),
  incomeUsd: z.number().nonnegative("El ingreso no puede ser negativo").optional(),
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;

/**
 * Saldo de ahorro actual por moneda (ancla del modelo `SavingsBalance`). Cada moneda
 * es opcional; guardar re-ancla el saldo al mes actual.
 */
export const savingsSchema = z.object({
  savingsArs: z.number().nonnegative("El ahorro no puede ser negativo").optional(),
  savingsUsd: z.number().nonnegative("El ahorro no puede ser negativo").optional(),
});

export type SavingsFormValues = z.infer<typeof savingsSchema>;
