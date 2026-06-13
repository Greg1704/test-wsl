import { describe, it, expect } from "vitest";
import { buildPurchasePlan } from "./purchase-plan";

describe("buildPurchasePlan", () => {
  const base = {
    cardClosingDay: 20,
    cardDueDay: 10,
    purchaseDate: new Date("2025-01-15"),
    currency: "ARS" as const,
  };

  it("sin recargo: reparte el monto original, suma exacta y sin TEM", () => {
    const plan = buildPurchasePlan({
      ...base,
      totalInstallments: 3,
      totalAmountCents: 10000n, // $100,00
    });
    expect(plan.hasSurcharge).toBe(false);
    expect(plan.surchargePct).toBe(0);
    expect(plan.tem).toBe(0);
    expect(plan.rows).toHaveLength(3);
    // 10000 / 3 = 3334 + 3333 + 3333 = 10000 (sobrante en la primera)
    expect(plan.rows.map((r) => r.amountCents)).toEqual([3334n, 3333n, 3333n]);
    expect(plan.totalCents).toBe(10000n);
  });

  it("financedTotal igual al monto ⇒ tratado como sin recargo", () => {
    const plan = buildPurchasePlan({
      ...base,
      totalInstallments: 3,
      totalAmountCents: 10000n,
      financedTotalCents: 10000n,
    });
    expect(plan.hasSurcharge).toBe(false);
    expect(plan.totalCents).toBe(10000n);
  });

  it("con recargo: reparte el total financiado, suma exacta y deriva recargo% + TEM", () => {
    // $100,00 ofrecido en 3 cuotas de $38,59 → financiado 11576 (3859+3859+3858)
    const plan = buildPurchasePlan({
      ...base,
      totalInstallments: 3,
      totalAmountCents: 10000n,
      financedTotalCents: 11576n,
    });
    expect(plan.hasSurcharge).toBe(true);
    expect(plan.totalCents).toBe(11576n);
    expect(plan.rows.map((r) => r.amountCents)).toEqual([3859n, 3859n, 3858n]);
    // Recargo: 11576/10000 - 1 = 15.76 %
    expect(plan.surchargePct).toBeCloseTo(15.76, 2);
    // TEM derivada del sistema francés ≈ 7,7 % mensual (amortizando capital).
    expect(plan.tem).toBeCloseTo(7.69, 1);
  });

  it("una sola cuota: el total entra completo en la cuota 1", () => {
    const plan = buildPurchasePlan({
      ...base,
      totalInstallments: 1,
      totalAmountCents: 12345n,
    });
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].amountCents).toBe(12345n);
    expect(plan.totalCents).toBe(12345n);
  });

  it("financedTotal menor al monto se ignora (no es recargo negativo)", () => {
    const plan = buildPurchasePlan({
      ...base,
      totalInstallments: 2,
      totalAmountCents: 10000n,
      financedTotalCents: 9000n,
    });
    expect(plan.hasSurcharge).toBe(false);
    expect(plan.totalCents).toBe(10000n);
  });
});
