import { percentOfIncome } from "./dashboard";
import type { PurchasePlan } from "./purchase-plan";
import type { SimulationImpact } from "./simulation";

/**
 * Comparación de dos escenarios del simulador (Fase 4, RF-8.3). Funciones puras:
 * derivan las métricas de un plan/impacto y la serie del chart overlay. Se testean
 * sin DB ni browser.
 */

export type ScenarioMetrics = {
  installments: number;
  /** Primera cuota (las demás difieren a lo sumo 1 centavo por el reparto). */
  firstInstallmentCents: bigint;
  totalCents: bigint;
  surchargePct: number;
  tem: number;
  /** Vencimiento de la última cuota: "cuándo te liberás de ESTA compra". */
  lastDueDate: Date;
  /** Mayor comprometido mensual (real + esta compra) del horizonte. */
  peakCommittedAfter: number;
  /** Ese pico como % del ingreso; null si no hay ingreso en la moneda (RF-9.1). */
  peakPercentOfIncome: number | null;
};

export function buildScenarioMetrics({
  plan,
  impact,
  income,
}: {
  plan: PurchasePlan;
  impact: SimulationImpact;
  income: number | null;
}): ScenarioMetrics {
  const peakCommittedAfter = impact.months.reduce(
    (max, m) => Math.max(max, m.committedAfter),
    0
  );
  const peakPercentOfIncome =
    income !== null
      ? percentOfIncome(
          BigInt(Math.round(peakCommittedAfter * 100)),
          BigInt(Math.round(income * 100))
        )
      : null;

  return {
    installments: plan.rows.length,
    firstInstallmentCents: plan.rows[0].amountCents,
    totalCents: plan.totalCents,
    surchargePct: plan.surchargePct,
    tem: plan.tem,
    lastDueDate: plan.rows[plan.rows.length - 1].dueDate,
    peakCommittedAfter,
    peakPercentOfIncome,
  };
}

export type ComparisonPoint = { label: string; a: number; b: number };

/**
 * Serie del chart overlay (solo misma moneda): el `committedAfter` de A y de B por
 * mes, sobre el horizonte común `max(horizonA, horizonB)`. Más allá del horizonte de
 * un escenario, su valor vuelve al baseline (esa compra ya terminó de pagarse).
 */
export function buildComparisonSeries({
  impactA,
  impactB,
  baselineCommitted,
}: {
  impactA: SimulationImpact;
  impactB: SimulationImpact;
  /** Comprometido real por mes de la moneda compartida (largo ≥ horizonte común). */
  baselineCommitted: number[];
}): ComparisonPoint[] {
  const horizon = Math.max(impactA.months.length, impactB.months.length);
  // El impacto más largo cubre todos los índices del horizonte común → de ahí los labels.
  const longer =
    impactA.months.length >= impactB.months.length ? impactA : impactB;

  const valueAt = (impact: SimulationImpact, i: number) =>
    i < impact.months.length ? impact.months[i].committedAfter : (baselineCommitted[i] ?? 0);

  return Array.from({ length: horizon }, (_, i) => ({
    label: longer.months[i].label,
    a: valueAt(impactA, i),
    b: valueAt(impactB, i),
  }));
}

/**
 * Serie del chart "puro": solo la cuota hipotética (`thisPurchase`) de A y de B por
 * mes, sin el comprometido real del baseline. Es la comparación encapsulada de los dos
 * planes entre sí (RF-9.1). Más allá del horizonte de un escenario su cuota es 0 (esa
 * compra ya terminó de pagarse). Solo se usa cuando A y B comparten moneda.
 */
export function buildPurchaseOnlySeries({
  impactA,
  impactB,
}: {
  impactA: SimulationImpact;
  impactB: SimulationImpact;
}): ComparisonPoint[] {
  const horizon = Math.max(impactA.months.length, impactB.months.length);
  const longer =
    impactA.months.length >= impactB.months.length ? impactA : impactB;

  const valueAt = (impact: SimulationImpact, i: number) =>
    i < impact.months.length ? impact.months[i].thisPurchase : 0;

  return Array.from({ length: horizon }, (_, i) => ({
    label: longer.months[i].label,
    a: valueAt(impactA, i),
    b: valueAt(impactB, i),
  }));
}
