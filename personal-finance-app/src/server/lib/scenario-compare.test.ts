import { describe, it, expect } from "vitest";
import {
  buildScenarioMetrics,
  buildComparisonSeries,
  buildPurchaseOnlySeries,
} from "./scenario-compare";
import type { PurchasePlan } from "./purchase-plan";
import type { SimulationImpact } from "./simulation";

function makePlan(rows: { amountCents: bigint; dueDate: Date }[]): PurchasePlan {
  return {
    rows: rows.map((r, i) => ({
      installmentNumber: i + 1,
      amountCents: r.amountCents,
      dueDate: r.dueDate,
      currency: "ARS",
      status: "PENDING" as const,
    })),
    totalCents: rows.reduce((acc, r) => acc + r.amountCents, 0n),
    hasSurcharge: false,
    surchargePct: 0,
    tem: 0,
  };
}

function makeImpact(committedAfter: number[], income: number | null = 1000): SimulationImpact {
  return {
    horizon: committedAfter.length,
    cards: [],
    income,
    months: committedAfter.map((ca, i) => ({
      label: `m${i}`,
      byCard: {},
      committedBefore: 0,
      thisPurchase: ca,
      committedAfter: ca,
      netBefore: income,
      netAfter: income !== null ? income - ca : null,
    })),
  };
}

describe("buildScenarioMetrics", () => {
  it("deriva las métricas clave del plan y el impacto", () => {
    const plan = makePlan([
      { amountCents: 5000n, dueDate: new Date("2025-02-10") },
      { amountCents: 5000n, dueDate: new Date("2025-03-10") },
    ]);
    const impact = makeImpact([600, 700, 500], 1000);

    const m = buildScenarioMetrics({ plan, impact, income: 1000 });
    expect(m.installments).toBe(2);
    expect(m.firstInstallmentCents).toBe(5000n);
    expect(m.totalCents).toBe(10000n);
    expect(m.lastDueDate).toEqual(new Date("2025-03-10"));
    expect(m.peakCommittedAfter).toBe(700);
    expect(m.peakPercentOfIncome).toBe(70); // 700 / 1000
  });

  it("sin ingreso en la moneda: peakPercentOfIncome es null", () => {
    const plan = makePlan([{ amountCents: 5000n, dueDate: new Date("2025-02-10") }]);
    const impact = makeImpact([500], null);
    const m = buildScenarioMetrics({ plan, impact, income: null });
    expect(m.peakPercentOfIncome).toBeNull();
    expect(m.peakCommittedAfter).toBe(500);
  });
});

describe("buildComparisonSeries", () => {
  it("usa el horizonte común y completa el escenario corto con el baseline", () => {
    const impactA = makeImpact([150, 150]); // horizonte 2
    const impactB = makeImpact([120, 120, 120, 120]); // horizonte 4
    const baselineCommitted = [100, 100, 100, 100];

    const series = buildComparisonSeries({ impactA, impactB, baselineCommitted });
    expect(series).toHaveLength(4);
    // Labels del impacto más largo (B).
    expect(series.map((p) => p.label)).toEqual(["m0", "m1", "m2", "m3"]);
    // Meses dentro del horizonte de A: su committedAfter.
    expect(series[1]).toMatchObject({ a: 150, b: 120 });
    // Más allá del horizonte de A (idx 2,3): A vuelve al baseline.
    expect(series[2]).toMatchObject({ a: 100, b: 120 });
    expect(series[3]).toMatchObject({ a: 100, b: 120 });
  });
});

describe("buildPurchaseOnlySeries", () => {
  it("grafica solo la cuota hipotética de cada plan, sin baseline", () => {
    // makeImpact pone thisPurchase = al valor pasado.
    const impactA = makeImpact([150, 150]); // horizonte 2
    const impactB = makeImpact([120, 120, 120, 120]); // horizonte 4

    const series = buildPurchaseOnlySeries({ impactA, impactB });
    expect(series).toHaveLength(4);
    expect(series.map((p) => p.label)).toEqual(["m0", "m1", "m2", "m3"]);
    // Dentro del horizonte de ambos: la cuota de cada uno.
    expect(series[1]).toMatchObject({ a: 150, b: 120 });
    // Más allá del horizonte de A: su cuota es 0 (no vuelve al baseline real).
    expect(series[2]).toMatchObject({ a: 0, b: 120 });
    expect(series[3]).toMatchObject({ a: 0, b: 120 });
  });
});
