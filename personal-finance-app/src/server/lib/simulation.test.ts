import { describe, it, expect } from "vitest";
import {
  buildSimulationImpact,
  SIM_CARD_ID,
  MAX_HORIZON,
  type BaselineMonth,
} from "./simulation";

/** Baseline de `len` meses, con un committed opcional por índice. */
function makeBaseline(len: number, committedByIdx: Record<number, number> = {}): BaselineMonth[] {
  return Array.from({ length: len }, (_, i) => {
    const committed = committedByIdx[i] ?? 0;
    const byCard: Record<string, number> = committed ? { real: committed } : {};
    return { label: `m${i}`, committed, byCard };
  });
}

const baselineCards = [{ id: "real", name: "Visa" }];

describe("buildSimulationImpact", () => {
  it("suma la compra al baseline y calcula el neto antes/después", () => {
    const impact = buildSimulationImpact({
      baseline: makeBaseline(MAX_HORIZON, { 1: 500, 2: 500, 3: 500 }),
      baselineCards,
      startYear: 2025,
      startMonth: 0, // enero 2025
      income: 1000,
      // 3 cuotas de $100 en feb/mar/abr (idx 1,2,3)
      hypoRows: [
        { dueDate: new Date("2025-02-10"), amountCents: 10000n },
        { dueDate: new Date("2025-03-10"), amountCents: 10000n },
        { dueDate: new Date("2025-04-10"), amountCents: 10000n },
      ],
    });

    const feb = impact.months[1];
    expect(feb.committedBefore).toBe(500);
    expect(feb.thisPurchase).toBe(100);
    expect(feb.committedAfter).toBe(600);
    expect(feb.netBefore).toBe(500); // 1000 - 500
    expect(feb.netAfter).toBe(400); // 1000 - 600
    expect(feb.byCard[SIM_CARD_ID]).toBe(100);

    // Un mes sin la compra: sin impacto.
    const may = impact.months[4];
    expect(may.thisPurchase).toBe(0);
    expect(may.netAfter).toBe(may.netBefore);
  });

  it("la tarjeta sintética 'Esta compra' va última (arriba de la pila)", () => {
    const impact = buildSimulationImpact({
      baseline: makeBaseline(MAX_HORIZON),
      baselineCards,
      startYear: 2025,
      startMonth: 0,
      income: null,
      hypoRows: [{ dueDate: new Date("2025-02-10"), amountCents: 10000n }],
    });
    expect(impact.cards[impact.cards.length - 1].id).toBe(SIM_CARD_ID);
    expect(impact.cards.map((c) => c.id)).toContain("real");
  });

  it("horizonte: ≥12 meses, y se estira para cubrir todas las cuotas", () => {
    // 24 cuotas mensuales desde feb 2025 → última en idx 24 → horizonte 25.
    const hypoRows = Array.from({ length: 24 }, (_, i) => ({
      dueDate: new Date(2025, 1 + i, 10), // feb 2025 + i (componentes locales)
      amountCents: 10000n,
    }));
    const impact = buildSimulationImpact({
      baseline: makeBaseline(MAX_HORIZON),
      baselineCards,
      startYear: 2025,
      startMonth: 0,
      income: 1000,
      hypoRows,
    });
    expect(impact.horizon).toBe(25);
    expect(impact.months).toHaveLength(25);
  });

  it("horizonte mínimo de 12 con una compra corta", () => {
    const impact = buildSimulationImpact({
      baseline: makeBaseline(MAX_HORIZON),
      baselineCards,
      startYear: 2025,
      startMonth: 0,
      income: 1000,
      hypoRows: [{ dueDate: new Date("2025-02-10"), amountCents: 10000n }],
    });
    expect(impact.horizon).toBe(12);
  });

  it("sin ingreso en la moneda (RF-9.1): el neto es null", () => {
    const impact = buildSimulationImpact({
      baseline: makeBaseline(MAX_HORIZON, { 1: 200 }),
      baselineCards,
      startYear: 2025,
      startMonth: 0,
      income: null,
      hypoRows: [{ dueDate: new Date("2025-02-10"), amountCents: 5000n }],
    });
    expect(impact.income).toBeNull();
    expect(impact.months[1].netBefore).toBeNull();
    expect(impact.months[1].netAfter).toBeNull();
    // El comprometido antes/después igual se calcula.
    expect(impact.months[1].committedAfter).toBe(250);
  });
});
