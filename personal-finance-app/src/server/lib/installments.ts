import { addMonths, setDate, getDate } from "date-fns";

interface GenerateInstallmentsInput {
  cardClosingDay: number;
  cardDueDay: number;
  purchaseDate: Date;
  totalInstallments: number;
  totalAmountCents: bigint;
  currency?: string;
}

interface InstallmentRow {
  installmentNumber: number;
  amountCents: bigint;
  dueDate: Date;
  currency: string;
  status: "PENDING";
}

export function generateInstallments(input: GenerateInstallmentsInput): InstallmentRow[] {
  const { cardClosingDay, cardDueDay, purchaseDate, totalInstallments, totalAmountCents, currency = "ARS" } = input;

  // ¿La compra entra en este cierre o pasa al siguiente?
  const purchaseDay = getDate(purchaseDate);
  const firstStatementMonth =
    purchaseDay <= cardClosingDay ? addMonths(purchaseDate, 1) : addMonths(purchaseDate, 2);

  const n = BigInt(totalInstallments);
  const baseCents = totalAmountCents / n;
  const remainder = totalAmountCents - baseCents * n;

  return Array.from({ length: totalInstallments }, (_, i) => ({
    installmentNumber: i + 1,
    amountCents: i === totalInstallments - 1 ? baseCents + remainder : baseCents,
    dueDate: setDate(addMonths(firstStatementMonth, i), cardDueDay),
    currency,
    status: "PENDING" as const,
  }));
}
