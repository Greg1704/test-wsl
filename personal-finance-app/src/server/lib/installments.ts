import { addMonths, setDate, getDate } from "date-fns";
import { nextBusinessDay } from "./dates";

interface GenerateInstallmentsInput {
  cardClosingDay: number;
  cardDueDay: number;
  purchaseDate: Date;
  totalInstallments: number;
  /**
   * Monto a repartir en cuotas: el total FINAL que paga el usuario (con recargo
   * si la compra tiene interés). Sin interés, es igual al monto original.
   */
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

/**
 * Tasa efectiva mensual (TEM) implícita en un plan de N cuotas iguales (RF-3.5),
 * derivada del monto original y el total financiado (con recargo). Se usa solo
 * para mostrar/analizar: el usuario ingresa el total final que le informa el
 * comercio, no la tasa.
 *
 * Resuelve por bisección la `i` que iguala el valor presente de las N cuotas al
 * monto original (sistema francés): original = cuota · (1 − (1+i)^−N) / i.
 * El VP es decreciente en `i`, así que la bisección converge. Devuelve el
 * porcentaje mensual (ej. `10` = 10 %). `0` si no hay recargo.
 */
export function impliedMonthlyRate(
  originalCents: bigint,
  financedCents: bigint,
  totalInstallments: number
): number {
  if (
    originalCents <= 0n ||
    financedCents <= originalCents ||
    totalInstallments < 1
  ) {
    return 0;
  }

  const original = Number(originalCents);
  const cuota = Number(financedCents) / totalInstallments;
  const n = totalInstallments;

  const presentValue = (i: number) =>
    i === 0 ? cuota * n : (cuota * (1 - Math.pow(1 + i, -n))) / i;

  // VP(0) = cuota·N = financiado ≥ original; con i alto el VP cae por debajo.
  let lo = 0; // 0 % mensual
  let hi = 5; // 500 % mensual: cota superior holgada para retail AR
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (presentValue(mid) > original) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/**
 * Genera las N filas de cuota repartiendo `totalAmountCents` (el total final) y
 * calculando el vencimiento de cada una según el ciclo de la tarjeta. Función
 * pura y testeada: ver docs/ARCHITECTURE.md y .claude/rules/dinero-y-fechas.md.
 */
export function generateInstallments(input: GenerateInstallmentsInput): InstallmentRow[] {
  const {
    cardClosingDay,
    cardDueDay,
    purchaseDate,
    totalInstallments,
    totalAmountCents,
    currency = "ARS",
  } = input;

  // ¿En qué resumen cae la compra? Si se compró hasta el día de cierre, cierra
  // este mes; si fue después, pasa al cierre del mes siguiente.
  const purchaseDay = getDate(purchaseDate);
  const statementClosingMonth =
    purchaseDay <= cardClosingDay ? purchaseDate : addMonths(purchaseDate, 1);

  // El pago vence en el primer `dueDay` POSTERIOR al cierre: el mismo mes del
  // cierre si el vencimiento cae más tarde en el mes (dueDay > closingDay), o el
  // mes siguiente si cae antes/igual (ese día ya pasó en el mes del cierre).
  const firstDueMonth =
    cardDueDay > cardClosingDay
      ? statementClosingMonth
      : addMonths(statementClosingMonth, 1);

  // Reparto en N cuotas iguales: los centavos sobrantes se reparten de a 1 entre
  // las PRIMERAS cuotas (como hacen los bancos), así la diferencia es de 1 centavo
  // y no se acumula en la última. Ver .claude/rules/dinero-y-fechas.md.
  const n = BigInt(totalInstallments);
  const baseCents = totalAmountCents / n;
  const remainder = Number(totalAmountCents - baseCents * n); // 0..N-1 centavos

  return Array.from({ length: totalInstallments }, (_, i) => ({
    installmentNumber: i + 1,
    amountCents: i < remainder ? baseCents + 1n : baseCents,
    // Si el vencimiento cae fin de semana, se corre al lunes siguiente.
    dueDate: nextBusinessDay(setDate(addMonths(firstDueMonth, i), cardDueDay)),
    currency,
    status: "PENDING" as const,
  }));
}
