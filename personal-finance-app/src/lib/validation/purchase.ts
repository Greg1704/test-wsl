import { z } from "zod";

/** Centinela del filtro "Sin categoría" (compras con categoryId null). */
export const NO_CATEGORY_FILTER = "__none__";

/** Medios de pago. CREDIT genera cuotas; el resto es pago único que sale del ahorro. */
export const PAYMENT_METHODS = ["CREDIT", "DEBIT", "TRANSFER", "CASH"] as const;

export const purchaseSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS),
    // Requerida para CREDIT/DEBIT (tarjeta); ausente para TRANSFER/EFECTIVO.
    cardId: z.cuid().optional(),
    categoryId: z.cuid().optional(),
    description: z.string().min(1, "La descripción es requerida").max(200),
    merchant: z.string().max(100).optional(),
    totalAmount: z
      .number({ error: "Ingresá el monto total" })
      .positive("El monto debe ser mayor a 0"),
    // Sin `.default()`: rompería el typing de zodResolver (input vs output). El form
    // y la Server Action siempre proveen la moneda (heredada de la tarjeta o elegida).
    currency: z.enum(["ARS", "USD"]),
    totalInstallments: z.number().int().min(1).max(60),
    purchaseDate: z.date(),
    /**
     * Total con recargo (interés) que informa el comercio. Solo crédito. Vacío o igual
     * al monto ⇒ sin interés. La tasa mensual se deriva de acá, no se ingresa.
     */
    financedTotal: z
      .number()
      .positive("El total con recargo debe ser mayor a 0")
      .optional(),
    /**
     * Cotización para imputar la compra al límite de crédito cuando su moneda difiere de
     * la principal del usuario (unidades de la principal por 1 de `currency`). Solo la pide
     * el form con el seguimiento de límites activo; el server la exige en ese caso. Se
     * guarda como snapshot en `Purchase.limitRate`.
     */
    limitRate: z
      .number()
      .positive("La cotización debe ser mayor a 0")
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((d, ctx) => {
    const needsCard = d.paymentMethod === "CREDIT" || d.paymentMethod === "DEBIT";
    if (needsCard && !d.cardId) {
      ctx.addIssue({ path: ["cardId"], code: "custom", message: "Elegí una tarjeta" });
    }
    // Los gastos no-crédito (débito/transferencia/efectivo) son pago único sin recargo.
    if (d.paymentMethod !== "CREDIT") {
      if (d.totalInstallments !== 1) {
        ctx.addIssue({
          path: ["totalInstallments"],
          code: "custom",
          message: "Los gastos no-crédito son de un solo pago",
        });
      }
      if (d.financedTotal != null) {
        ctx.addIssue({
          path: ["financedTotal"],
          code: "custom",
          message: "Solo las compras a crédito admiten recargo",
        });
      }
    }
    if (d.financedTotal != null && d.financedTotal < d.totalAmount) {
      ctx.addIssue({
        path: ["financedTotal"],
        code: "custom",
        message: "El total con recargo no puede ser menor al monto",
      });
    }
  });

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;

/**
 * Edición de una compra: SOLO campos descriptivos (RF-3.6). El monto, las cuotas,
 * la fecha y la tarjeta no se editan acá porque recalcularían las cuotas ya
 * materializadas. Para cambiar eso, se borra y se vuelve a registrar la compra.
 */
// `null` = limpiar el campo explícitamente; ausente (`undefined`) = no tocarlo.
// Distinguir ambas semánticas evita que un update parcial borre datos no enviados.
export const editPurchaseSchema = z.object({
  description: z.string().min(1, "La descripción es requerida").max(200),
  categoryId: z.cuid().nullable().optional(),
  merchant: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type EditPurchaseFormValues = z.infer<typeof editPurchaseSchema>;

/** Filtros del listado de compras (RF-3.8). Todos opcionales. */
export const purchaseFiltersSchema = z.object({
  cardId: z.cuid().optional(),
  // Acepta un id de categoría o el centinela "Sin categoría".
  categoryId: z.union([z.cuid(), z.literal(NO_CATEGORY_FILTER)]).optional(),
  currency: z.enum(["ARS", "USD"]).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  /** Cualquier día del mes a filtrar; se usa el rango [inicio, fin] del mes. */
  month: z.date().optional(),
  /** Página del listado (1-based). */
  page: z.number().int().min(1).optional(),
});

export type PurchaseFilters = z.infer<typeof purchaseFiltersSchema>;
