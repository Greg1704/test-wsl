import { addMonths, setDate, getDate, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export { addMonths, setDate, getDate, parseISO };

export function formatDate(date: Date, pattern: string = "d MMM yyyy"): string {
  return format(date, pattern, { locale: es });
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy", { locale: es });
}
