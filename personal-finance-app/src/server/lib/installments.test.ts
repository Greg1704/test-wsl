import { describe, it, expect } from "vitest";
import { generateInstallments, surchargedTotalCents } from "./installments";

describe("generateInstallments", () => {
  const base = {
    cardClosingDay: 20,
    cardDueDay: 10,
    currency: "ARS" as const,
  };

  it("genera N cuotas con la cantidad correcta", () => {
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 3,
      totalAmountCents: 300n,
    });
    expect(result).toHaveLength(3);
    expect(result[0].installmentNumber).toBe(1);
    expect(result[2].installmentNumber).toBe(3);
  });

  it("distribuye centavos exactos sin pérdida", () => {
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 3,
      totalAmountCents: 100n,
    });
    const total = result.reduce((acc, r) => acc + r.amountCents, 0n);
    expect(total).toBe(100n);
  });

  it("la última cuota absorbe el sobrante del redondeo", () => {
    // 100 / 3 = 33 resto 1 → cuotas: 33, 33, 34
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 3,
      totalAmountCents: 100n,
    });
    expect(result[0].amountCents).toBe(33n);
    expect(result[1].amountCents).toBe(33n);
    expect(result[2].amountCents).toBe(34n);
  });

  it("compra antes del cierre → primer vencimiento el mes siguiente", () => {
    // Cierre día 20, compra día 15 → entra en este cierre → vence en feb
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 1,
      totalAmountCents: 1000n,
    });
    expect(result[0].dueDate.getMonth()).toBe(1); // febrero (0-indexed)
    expect(result[0].dueDate.getDate()).toBe(10);
  });

  it("compra después del cierre → primer vencimiento salta dos meses", () => {
    // Cierre día 20, compra día 25 → NO entra → vence en marzo
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-25"),
      totalInstallments: 1,
      totalAmountCents: 1000n,
    });
    expect(result[0].dueDate.getMonth()).toBe(2); // marzo (0-indexed)
    expect(result[0].dueDate.getDate()).toBe(10);
  });

  it("todas las cuotas tienen status PENDING", () => {
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 6,
      totalAmountCents: 60000n,
    });
    result.forEach((r) => expect(r.status).toBe("PENDING"));
  });
});

describe("interés (RF-3.5: monto recargado en N cuotas iguales)", () => {
  const base = {
    cardClosingDay: 20,
    cardDueDay: 10,
    purchaseDate: new Date("2025-01-15"),
    currency: "ARS" as const,
  };

  it("tasa null o 0 ⇒ sin recargo (idéntico al caso sin interés)", () => {
    expect(surchargedTotalCents(10000n, null, 6)).toBe(10000n);
    expect(surchargedTotalCents(10000n, 0, 6)).toBe(10000n);
    expect(surchargedTotalCents(10000n, undefined, 6)).toBe(10000n);

    const sinTasa = generateInstallments({ ...base, totalInstallments: 6, totalAmountCents: 60000n });
    const tasaCero = generateInstallments({
      ...base,
      totalInstallments: 6,
      totalAmountCents: 60000n,
      interestRateMonthly: 0,
    });
    expect(tasaCero.map((r) => r.amountCents)).toEqual(sinTasa.map((r) => r.amountCents));
  });

  it("tasa positiva con N chico (3 cuotas al 5% mensual)", () => {
    // 10000 * 1.05^3 = 11576.25 → 11576 ; 11576/3 = 3858 resto 2 → 3858, 3858, 3860
    expect(surchargedTotalCents(10000n, 5, 3)).toBe(11576n);

    const result = generateInstallments({
      ...base,
      totalInstallments: 3,
      totalAmountCents: 10000n,
      interestRateMonthly: 5,
    });
    expect(result.map((r) => r.amountCents)).toEqual([3858n, 3858n, 3860n]);
    const total = result.reduce((acc, r) => acc + r.amountCents, 0n);
    expect(total).toBe(11576n);
  });

  it("la suma de cuotas iguala exactamente el total recargado (24 cuotas al 8%)", () => {
    const totalAmountCents = 1_234_567n;
    const interestRateMonthly = 8;
    const totalInstallments = 24;

    const recargado = surchargedTotalCents(totalAmountCents, interestRateMonthly, totalInstallments);
    expect(recargado).toBeGreaterThan(totalAmountCents);

    const result = generateInstallments({
      ...base,
      totalInstallments,
      totalAmountCents,
      interestRateMonthly,
    });
    const total = result.reduce((acc, r) => acc + r.amountCents, 0n);
    expect(total).toBe(recargado);
    expect(result).toHaveLength(24);
  });

  it("la última cuota absorbe el redondeo también con interés", () => {
    const result = generateInstallments({
      ...base,
      totalInstallments: 3,
      totalAmountCents: 10000n,
      interestRateMonthly: 5,
    });
    // las primeras N-1 son iguales; la última puede diferir por el resto
    expect(result[0].amountCents).toBe(result[1].amountCents);
    const recargado = surchargedTotalCents(10000n, 5, 3);
    expect(result[2].amountCents).toBe(recargado - result[0].amountCents * 2n);
  });
});
