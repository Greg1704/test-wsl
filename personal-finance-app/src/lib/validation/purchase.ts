import { z } from "zod";

/** Centinela del filtro "Sin categoría" (compras con categoryId null). */
export const NO_CATEGORY_FILTER = "__none__";

export const purchaseSchema = z
  .object({
    cardId: z.cuid({ error: "Elegí una tarjeta" }),
    categoryId: z.cuid().optional(),
    description: z.string().min(1, "La descripción es requerida").max(200),
    merchant: z.string().max(100).optional(),
    totalAmount: z
      .number({ error: "Ingresá el monto total" })
      .positive("El monto debe ser mayor a 0"),
    // Sin `.default()`: rompería el typing de zodResolver (input vs output). El form
    // y la Server Action siempre proveen la moneda (heredada de la tarjeta).
    currency: z.enum(["ARS", "USD"]),
    totalInstallments: z.number().int().min(1).max(60),
    purchaseDate: z.date(),
    /**
     * Total con recargo (interés) que informa el comercio. Vacío o igual al monto
     * ⇒ compra sin interés. La tasa mensual se deriva de acá, no se ingresa.
     */
    financedTotal: z
      .number()
      .positive("El total con recargo debe ser mayor a 0")
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.financedTotal == null || d.financedTotal >= d.totalAmount, {
    path: ["financedTotal"],
    error: "El total con recargo no puede ser menor al monto",
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
  /** Cualquier día del mes a filtrar; se usa el rango [inicio, fin] del mes. */
  month: z.date().optional(),
});

export type PurchaseFilters = z.infer<typeof purchaseFiltersSchema>;
