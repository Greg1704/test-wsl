import { addMonths, setDate, getDate } from "date-fns";
import { nextBusinessDay } from "./dates";

interface GenerateInstallmentsInput {
  cardClosingDay: number;
  cardDueDay: number;
  purchaseDate: Date;
  totalInstallments: number;
  totalAmountCents: bigint;
  /** Tasa mensual en % (ej. `5` = 5 %). `null`/`0`/`undefined` ⇒ sin recargo. */
  interestRateMonthly?: number | null;
  currency?: string;
}

interface InstallmentRow {
  installmentNumber: number;
  amountCents: bigint;
  dueDate: Date;
  currency: string;
  status: "PENDING";
}

/**
 * Monto total recargado por interés compuesto mensual (RF-3.5).
 * Ver "Cálculo de cuotas con interés" en docs/ARCHITECTURE.md.
 *
 * total recargado = round( totalAmountCents * (1 + tasa/100)^N )
 * El factor se calcula en punto flotante y se redondea al centavo una sola vez;
 * de ahí en más el reparto es aritmética entera (BigInt).
 */
export function surchargedTotalCents(
  totalAmountCents: bigint,
  interestRateMonthly: number | null | undefined,
  totalInstallments: number
): bigint {
  const i = (interestRateMonthly ?? 0) / 100;
  if (i <= 0) return totalAmountCents;

  const factor = Math.pow(1 + i, totalInstallments);
  return BigInt(Math.round(Number(totalAmountCents) * factor));
}

export function generateInstallments(input: GenerateInstallmentsInput): InstallmentRow[] {
  const {
    cardClosingDay,
    cardDueDay,
    purchaseDate,
    totalInstallments,
    totalAmountCents,
    interestRateMonthly,
    currency = "ARS",
  } = input;

  // ¿La compra entra en este cierre o pasa al siguiente?
  const purchaseDay = getDate(purchaseDate);
  const firstStatementMonth =
    purchaseDay <= cardClosingDay ? addMonths(purchaseDate, 1) : addMonths(purchaseDate, 2);

  // Aplicar el recargo por interés antes de repartir.
  const total = surchargedTotalCents(totalAmountCents, interestRateMonthly, totalInstallments);

  const n = BigInt(totalInstallments);
  const baseCents = total / n;
  const remainder = total - baseCents * n;

  return Array.from({ length: totalInstallments }, (_, i) => ({
    installmentNumber: i + 1,
    amountCents: i === totalInstallments - 1 ? baseCents + remainder : baseCents,
    // Si el vencimiento cae fin de semana, se corre al lunes siguiente.
    dueDate: nextBusinessDay(setDate(addMonths(firstStatementMonth, i), cardDueDay)),
    currency,
    status: "PENDING" as const,
  }));
}
