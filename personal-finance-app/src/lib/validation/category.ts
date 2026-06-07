import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(40),
  /** Color de acento (hex u otro token de UI). Opcional. */
  color: z.string().max(20).optional(),
  /** Nombre de un ícono (lucide). Opcional. */
  icon: z.string().max(40).optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
