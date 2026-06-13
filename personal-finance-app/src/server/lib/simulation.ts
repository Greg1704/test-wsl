/**
 * Cálculo del impacto de una compra hipotética sobre la proyección de flujo
 * (Fase 4, RF-8.2). Función pura: toma el baseline ya agregado por mes (cuotas
 * reales, en unidades de moneda) y las cuotas hipotéticas, y devuelve el
 * "antes/después" mes a mes más el disponible neto. Se testea sin DB ni browser.
 *
 * El baseline lo arma el server en UTC (reusa `buildProjection`); las cuotas
 * hipotéticas se generan en el cliente, pero el bucketing por mes acá usa el
 * año/mes calendario (no timestamps), así que es TZ-safe: una cuota cae en un
 * mes inequívoco (cierre/vencimiento siempre en la primera quincena).
 */

/** "Tarjeta" sintética para el segmento de la compra simulada en el chart apilado. */
export const SIM_CARD_ID = "__sim__";
export const SIM_CARD_NAME = "Esta compra";

/** Tope de meses que el simulador puede proyectar (cubre hasta 60 cuotas + offset). */
export const MAX_HORIZON = 61;

export type BaselineMonth = {
  label: string; // "ene 25" ya formateado en el server
  committed: number; // total comprometido del mes (cuotas reales), en moneda
  byCard: Record<string, number>; // cardId → monto del mes
};

export type SimulationInput = {
  baseline: BaselineMonth[];
  baselineCards: { id: string; name: string }[];
  /** Año/mes (0-11) del índice 0 del baseline; el server los provee. */
  startYear: number;
  startMonth: number;
  /** Ingreso mensual en la moneda simulada, o null si no aplica (RF-9.1). */
  income: number | null;
  /** Cuotas hipotéticas (de `buildPurchasePlan`). */
  hypoRows: { dueDate: Date; amountCents: bigint }[];
};

export type SimulationMonth = {
  label: string;
  byCard: Record<string, number>; // baseline + SIM_CARD_ID, para el chart apilado
  committedBefore: number;
  thisPurchase: number;
  committedAfter: number;
  netBefore: number | null;
  netAfter: number | null;
};

export type SimulationImpact = {
  horizon: number;
  /** Tarjetas del baseline + la sintética "Esta compra" (último = arriba de la pila). */
  cards: { id: string; name: string }[];
  months: SimulationMonth[];
  income: number | null;
};

export function buildSimulationImpact(input: SimulationInput): SimulationImpact {
  const { baseline, baselineCards, startYear, startMonth, income, hypoRows } = input;

  // Índice de mes calendario relativo al inicio del baseline (igual que buildProjection).
  const monthIndex = (d: Date) =>
    (d.getFullYear() - startYear) * 12 + (d.getMonth() - startMonth);

  // Cuotas hipotéticas bucketeadas por mes (suma en centavos, sin drift de float).
  const hypoCentsByMonth = new Map<number, bigint>();
  let lastIdx = 0;
  for (const row of hypoRows) {
    const idx = monthIndex(row.dueDate);
    if (idx < 0) continue;
    hypoCentsByMonth.set(idx, (hypoCentsByMonth.get(idx) ?? 0n) + row.amountCents);
    if (idx > lastIdx) lastIdx = idx;
  }

  // El horizonte cubre al menos 12 meses y se estira para mostrar todas las cuotas,
  // sin pasar el baseline disponible.
  const horizon = Math.min(Math.max(12, lastIdx + 1), baseline.length);

  const months: SimulationMonth[] = [];
  for (let i = 0; i < horizon; i++) {
    const b = baseline[i];
    const committedBefore = b.committed;
    const thisPurchase = Number(hypoCentsByMonth.get(i) ?? 0n) / 100;
    const committedAfter = committedBefore + thisPurchase;
    months.push({
      label: b.label,
      byCard: { ...b.byCard, [SIM_CARD_ID]: thisPurchase },
      committedBefore,
      thisPurchase,
      committedAfter,
      netBefore: income !== null ? income - committedBefore : null,
      netAfter: income !== null ? income - committedAfter : null,
    });
  }

  return {
    horizon,
    cards: [...baselineCards, { id: SIM_CARD_ID, name: SIM_CARD_NAME }],
    months,
    income,
  };
}
