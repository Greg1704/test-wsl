import { z } from "zod";

/** Configuración del usuario: ingreso mensual + moneda principal (RF-5.1). */
export const incomeSchema = z.object({
  monthlyIncome: z
    .number({ error: "Ingresá un monto" })
    .positive("El ingreso debe ser mayor a 0"),
  defaultCurrency: z.enum(["ARS", "USD"]),
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;
