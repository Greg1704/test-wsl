import { generateInstallments, impliedMonthlyRate } from "./installments";

interface BuildPurchasePlanInput {
  cardClosingDay: number;
  cardDueDay: number;
  purchaseDate: Date;
  totalInstallments: number;
  /** Monto original (sin recargo), en centavos. */
  totalAmountCents: bigint;
  /** Total con recargo informado por el comercio, en centavos. Ausente/≤ original ⇒ sin recargo. */
  financedTotalCents?: bigint;
  currency: string;
}

export interface PurchasePlan {
  rows: ReturnType<typeof generateInstallments>;
  /** Suma de las cuotas = total que se paga (con recargo si lo hay). */
  totalCents: bigint;
  hasSurcharge: boolean;
  /** Recargo sobre el monto original, en porcentaje (ej. 15.7). 0 si no hay. */
  surchargePct: number;
  /** TEM derivada (sistema francés), en porcentaje mensual. 0 si no hay recargo. */
  tem: number;
}

/**
 * Arma el plan de una compra en cuotas a partir de los inputs (sin tocar la DB):
 * reparte el total final en N cuotas con sus vencimientos (`generateInstallments`)
 * y deriva el recargo % y la TEM (`impliedMonthlyRate`). Función pura y testeada.
 *
 * Es la lógica compartida entre el preview en vivo del form de compra y el
 * simulador (Fase 4): misma cuenta, una sola fuente de verdad.
 */
export function buildPurchasePlan(input: BuildPurchasePlanInput): PurchasePlan {
  const { totalAmountCents, financedTotalCents, totalInstallments } = input;

  const hasSurcharge =
    financedTotalCents != null && financedTotalCents > totalAmountCents;
  // El total que se reparte en cuotas es el final (con recargo); sin recargo, el original.
  const financedCents = hasSurcharge ? financedTotalCents! : totalAmountCents;
  const n = totalInstallments || 1;

  const rows = generateInstallments({
    cardClosingDay: input.cardClosingDay,
    cardDueDay: input.cardDueDay,
    purchaseDate: input.purchaseDate,
    totalInstallments: n,
    totalAmountCents: financedCents,
    currency: input.currency,
  });

  const totalCents = rows.reduce((acc, r) => acc + r.amountCents, 0n);
  const surchargePct = hasSurcharge
    ? (Number(financedCents) / Number(totalAmountCents) - 1) * 100
    : 0;
  const tem = hasSurcharge
    ? impliedMonthlyRate(totalAmountCents, financedCents, n)
    : 0;

  return { rows, totalCents, hasSurcharge, surchargePct, tem };
}
