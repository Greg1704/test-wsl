import { z } from "zod";

/**
 * Inputs del simulador (Fase 4, RF-8.1): una compra hipotética que NO se persiste.
 * Solo lo que afecta el flujo de cuotas — sin descripción/categoría/comercio, que
 * son datos de registro, no de simulación. La moneda default es la primera de la
 * tarjeta; si la tarjeta opera varias, el usuario la elige (debe ser una de ellas).
 */
export const simulatorSchema = z
  .object({
    cardId: z.cuid({ error: "Elegí una tarjeta" }),
    /** Moneda del plan. Vacío ⇒ se usa la primera de la tarjeta (ver useScenario). */
    currency: z.enum(["ARS", "USD"]).optional(),
    totalAmount: z
      .number({ error: "Ingresá el monto" })
      .positive("El monto debe ser mayor a 0"),
    totalInstallments: z.number().int().min(1).max(60),
    purchaseDate: z.date(),
    /** Total con recargo informado por el comercio. Vacío o = monto ⇒ sin recargo. */
    financedTotal: z
      .number()
      .positive("El total con recargo debe ser mayor a 0")
      .optional(),
    /**
     * Cotización para proyectar la utilización del límite cuando la compra simulada es en
     * otra moneda que la principal (moneda del límite por 1 de la compra). Solo se pide en
     * ese caso; no afecta el flujo de cuotas, solo la barra de límite.
     */
    limitRate: z
      .number()
      .positive("La cotización debe ser mayor a 0")
      .optional(),
  })
  .refine((d) => d.financedTotal == null || d.financedTotal >= d.totalAmount, {
    path: ["financedTotal"],
    error: "El total con recargo no puede ser menor al monto",
  });

export type SimulatorFormValues = z.infer<typeof simulatorSchema>;
