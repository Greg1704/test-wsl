import { z } from "zod";

import { parseExpiration, isCardExpired } from "@/server/lib/dates";

const MMYY = /^(0[1-9]|1[0-2])\/\d{2}$/;

/**
 * Alta/edición de tarjeta. El ciclo de facturación (cierre/vencimiento) y el
 * vencimiento MM/AA solo aplican a tarjetas de CRÉDITO: el débito gasta contra el
 * saldo al instante. Por eso esos campos son opcionales en el tipo y se exigen
 * condicionalmente con `superRefine` según `type`.
 */
export const cardSchema = z
  .object({
    type: z.enum(["CREDIT", "DEBIT"]),
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
    // Solo crédito (MM/AA). La conversión a Date se hace en la Server Action.
    expiration: z.string().optional(),
    closingDay: z.number().int().min(1, "Día inválido").max(31, "Día inválido").optional(),
    dueDay: z.number().int().min(1, "Día inválido").max(31, "Día inválido").optional(),
    // Una tarjeta opera al menos una moneda; puede tener ARS y USD (mismo ciclo).
    // Deduplicamos por si el form manda repetidos.
    currencies: z
      .array(z.enum(["ARS", "USD"]))
      .min(1, "Elegí al menos una moneda")
      .transform((v) => Array.from(new Set(v))),
    // Límite de crédito en unidades de la moneda principal (pesos/dólares enteros).
    // Requerido para crédito (validado en superRefine); la Server Action lo convierte a
    // centavos. `nullish` para permitir el campo vacío mientras se edita y para el débito
    // (que no tiene límite): el vacío llega como `null` y superRefine lo exige si es crédito.
    creditLimit: z.number().int("Ingresá un número entero").positive("Debe ser mayor a 0").nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "CREDIT") return; // el débito no tiene ciclo ni vencimiento
    if (!data.expiration || !MMYY.test(data.expiration)) {
      ctx.addIssue({
        path: ["expiration"],
        code: "custom",
        message: "Formato MM/AA (ej. 08/27)",
      });
    } else if (isCardExpired(parseExpiration(data.expiration))) {
      ctx.addIssue({
        path: ["expiration"],
        code: "custom",
        message: "La tarjeta ya está vencida",
      });
    }
    if (data.closingDay == null) {
      ctx.addIssue({ path: ["closingDay"], code: "custom", message: "Día inválido" });
    }
    if (data.dueDay == null) {
      ctx.addIssue({ path: ["dueDay"], code: "custom", message: "Día inválido" });
    }
    if (data.creditLimit == null) {
      ctx.addIssue({
        path: ["creditLimit"],
        code: "custom",
        message: "El límite de crédito es requerido",
      });
    }
  });

export type CardFormValues = z.infer<typeof cardSchema>;

/**
 * Renovación de una tarjeta vencida: SOLO un nuevo vencimiento MM/AA futuro. No
 * toca el resto de los datos (es la misma cuenta), así las cuotas siguen atadas.
 */
export const renewCardSchema = z.object({
  expiration: z
    .string()
    .regex(MMYY, "Formato MM/AA (ej. 08/29)")
    .refine((v) => !MMYY.test(v) || !isCardExpired(parseExpiration(v)), {
      message: "El nuevo vencimiento debe ser una fecha futura",
    }),
});

export type RenewCardValues = z.infer<typeof renewCardSchema>;
