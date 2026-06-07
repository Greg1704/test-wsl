import { startOfDay } from "date-fns";

import { InstallmentStatus } from "@/generated/prisma/client";

/**
 * Estado de una cuota *para mostrar* (RF-4.4).
 *
 * `OVERDUE` no se persiste: la DB solo guarda `PENDING` / `PAID`. Una cuota
 * `PENDING` cuyo vencimiento ya pasó se considera vencida en el momento de leer,
 * sin necesidad de un cron que actualice la columna. Una cuota `PAID` nunca pasa
 * a `OVERDUE`, aunque se haya pagado tarde.
 *
 * Función pura (sin I/O): vive en `lib/` y se testea sin DB.
 *
 * @param status  estado persistido de la cuota.
 * @param dueDate fecha de vencimiento (`@db.Date`, sin hora).
 * @param today   referencia de "hoy" (inyectable para testear); default: ahora.
 */
export function computeDisplayStatus(
  status: InstallmentStatus,
  dueDate: Date,
  today: Date = new Date()
): InstallmentStatus {
  if (status !== InstallmentStatus.PENDING) return status;
  // Comparamos por día calendario: una cuota que vence HOY no está vencida.
  return startOfDay(dueDate) < startOfDay(today)
    ? InstallmentStatus.OVERDUE
    : InstallmentStatus.PENDING;
}
