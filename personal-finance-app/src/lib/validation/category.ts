import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(40),
  /**
   * Color de acento en formato hex `#rrggbb`. Se restringe a hex estricto (no un
   * string libre) por seguridad: el valor termina inyectado en un `<style>` vía
   * `dangerouslySetInnerHTML` (ver `chart.tsx` → `ChartStyle`), así que un color
   * arbitrario permitiría inyección CSS. La UI solo ofrece presets hex
   * (`CATEGORY_COLORS`); esta regla es el respaldo del server (endpoint público).
   */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .optional(),
  /** Nombre de un ícono (lucide). Opcional. */
  icon: z.string().max(40).optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
