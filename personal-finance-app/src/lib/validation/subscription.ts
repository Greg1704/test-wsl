import { z } from "zod";

/** Medios de pago de una suscripción. Efectivo/transferencia quedan fuera por ahora. */
export const SUB_METHODS = ["CREDIT", "DEBIT"] as const;

/**
 * Alta/edición de una suscripción (gasto recurrente). Reusado por el form (cliente) y la
 * Server Action (servidor). El `limitRate` queda opcional acá: el server lo exige cuando
 * corresponde (crédito con seguimiento de límite activo + tarjeta con límite + moneda ≠
 * principal), porque el schema no conoce la moneda principal del usuario ni el límite de la
 * tarjeta. La pertenencia `currency ∈ card.currencies` también se valida en el server.
 */
export const subscriptionSchema = z
  .object({
    name: z.string().min(1, "El nombre es requerido").max(100),
    amount: z
      .number({ error: "Ingresá el monto mensual" })
      .positive("El monto debe ser mayor a 0"),
    currency: z.enum(["ARS", "USD"]),
    paymentMethod: z.enum(SUB_METHODS),
    // Requerida para CREDIT (validado abajo); opcional para DEBIT (puede o no tener tarjeta).
    cardId: z.cuid().optional(),
    categoryId: z.cuid().optional(),
    // Ancla de recurrencia: define el día del cobro y desde qué mes corre.
    firstChargeDate: z.date({ error: "Elegí la fecha del primer cobro" }),
    // Baja opcional (inclusive: cobra el mes de la baja y no después).
    endDate: z.date().optional(),
    /** Cotización para imputar al límite cuando la suscripción de crédito no está en la
     * moneda principal (unidades de la principal por 1 de `currency`). Snapshot en Subscription. */
    limitRate: z
      .number()
      .positive("La cotización debe ser mayor a 0")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.paymentMethod === "CREDIT" && !v.cardId) {
      ctx.addIssue({
        path: ["cardId"],
        code: "custom",
        message: "Elegí una tarjeta de crédito",
      });
    }
    if (v.endDate && v.endDate < v.firstChargeDate) {
      ctx.addIssue({
        path: ["endDate"],
        code: "custom",
        message: "La baja no puede ser anterior al primer cobro",
      });
    }
  });

export type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

/** Estados con los que el usuario puede marcar un cobro puntual de un mes. */
export const CHARGE_ACTIONS = ["PAID", "SKIPPED", "RESET"] as const;

/**
 * Acción sobre el cobro de un mes concreto de una suscripción: marcarlo pagado, saltearlo
 * o volverlo a pendiente (RESET borra el override). `periodMonth` es cualquier día del mes;
 * el server lo normaliza al primero. `paidFromSavings` solo aplica a PAID.
 */
export const chargeActionSchema = z.object({
  subscriptionId: z.cuid(),
  periodMonth: z.date(),
  action: z.enum(CHARGE_ACTIONS),
  paidFromSavings: z.boolean().optional(),
});

export type ChargeActionValues = z.infer<typeof chargeActionSchema>;
