import { formatDate, formatMonthYear } from "@/server/lib/dates";
import { formatMoney } from "@/server/lib/money";
import type { MonthlyOverview } from "@/server/queries/monthly-overview";

/** Una línea del reporte: ya con los montos formateados para mostrar en el mail. */
export type ReportLine = {
  currency: string;
  committed: string;
  income: string | null;
  net: string | null;
  /** `true` si el disponible neto quedó en rojo (cuotas > ingreso). */
  netNegative: boolean;
  nextDue: { date: string; amount: string } | null;
};

export type MonthlyReportContent = {
  subject: string;
  monthLabel: string;
  lines: ReportLine[];
};

/** Hay deuda en el mes si alguna moneda tiene cuotas comprometidas (> 0). */
export function hasDebtThisMonth(overview: MonthlyOverview): boolean {
  return overview.currencies.some((c) => c.committedCents > 0n);
}

/**
 * Arma el contenido del mail mensual a partir del overview del mes. Función pura
 * (formatea con `formatMoney`/`formatDate`, sin I/O): se testea sin DB ni Resend.
 * Solo incluye las monedas con cuotas comprometidas en el mes (lo que se paga).
 */
export function buildMonthlyReport(
  overview: MonthlyOverview,
  month: Date
): MonthlyReportContent {
  const monthLabel = formatMonthYear(month);

  const lines: ReportLine[] = overview.currencies
    .filter((c) => c.committedCents > 0n)
    .map((c) => ({
      currency: c.currency,
      committed: formatMoney(c.committedCents, c.currency),
      income: c.incomeCents !== null ? formatMoney(c.incomeCents, c.currency) : null,
      net: c.netCents !== null ? formatMoney(c.netCents, c.currency) : null,
      netNegative: c.netCents !== null && c.netCents < 0n,
      nextDue: c.nextDue
        ? {
            date: formatDate(c.nextDue.dueDate),
            amount: formatMoney(c.nextDue.amountCents, c.currency),
          }
        : null,
    }));

  return {
    subject: `Tus cuotas de ${monthLabel} — CuotApp`,
    monthLabel,
    lines,
  };
}
