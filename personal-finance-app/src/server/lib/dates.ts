import {
  addMonths,
  setDate,
  getDate,
  addDays,
  getDay,
  lastDayOfMonth,
  startOfDay,
  startOfMonth,
  startOfToday,
  format,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";

export { addMonths, setDate, getDate, addDays, startOfMonth, startOfToday, parseISO };

/** "YYYY-MM" → primer día de ese mes (hora local). `undefined` si no es válido. */
export function monthParamToDate(month?: string): Date | undefined {
  if (!month) return undefined;
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** "YYYY-MM" de una fecha, para armar los links de navegación mes a mes. */
export function formatMonthParam(date: Date): string {
  return format(date, "yyyy-MM");
}

/**
 * Rango [inicio, finExclusivo) de un mes para filtrar columnas `@db.Date`.
 * Borde superior EXCLUSIVO (`lt`) a propósito: con `lte: endOfMonth` el wall-clock
 * local 23:59:59 cae el día 1 siguiente en UTC (AR, UTC-3) y arrastra cuotas del
 * mes siguiente. Ver .claude/rules/dinero-y-fechas.md.
 */
export function monthRange(month: Date): { gte: Date; lt: Date } {
  return { gte: startOfMonth(month), lt: startOfMonth(addMonths(month, 1)) };
}

/**
 * Convierte "MM/AA" en el último día de ese mes (la tarjeta es válida hasta fin
 * del mes de vencimiento). Ej: "08/27" → 2027-08-31.
 */
export function parseExpiration(mmYY: string): Date {
  const [mm, yy] = mmYY.split("/");
  const month = Number(mm) - 1; // 0-indexed
  const year = 2000 + Number(yy);
  return lastDayOfMonth(new Date(year, month, 1));
}

/** Formatea una fecha de vencimiento como "MM/AA" (para precargar el form). */
export function formatExpiration(date: Date): string {
  return format(date, "MM/yy");
}

/** True si la tarjeta ya venció (su fecha de vencimiento quedó antes de hoy). */
export function isCardExpired(expirationDate: Date): boolean {
  return expirationDate < startOfDay(new Date());
}

/**
 * Si la fecha cae sábado o domingo, la corre al lunes siguiente (día hábil).
 *
 * Los feriados NO se contemplan a propósito: en Argentina son impredecibles por
 * código (los "puente" turísticos se declaran por decreto cada año) y CuotApp es
 * una proyección de flujo, no el sistema del banco. Ver ARCHITECTURE.md.
 */
export function nextBusinessDay(date: Date): Date {
  const day = getDay(date); // 0 = domingo, 6 = sábado
  if (day === 6) return addDays(date, 2);
  if (day === 0) return addDays(date, 1);
  return date;
}

export function formatDate(date: Date, pattern: string = "d MMM yyyy"): string {
  return format(date, pattern, { locale: es });
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy", { locale: es });
}
