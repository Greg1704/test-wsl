import { describe, it, expect } from "vitest";
import { generateInstallments, impliedMonthlyRate } from "./installments";

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

  it("los centavos sobrantes se reparten en las primeras cuotas", () => {
    // 100 / 3 = 33 resto 1 → el centavo sobrante va a la PRIMERA: 34, 33, 33
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 3,
      totalAmountCents: 100n,
    });
    expect(result[0].amountCents).toBe(34n);
    expect(result[1].amountCents).toBe(33n);
    expect(result[2].amountCents).toBe(33n);
  });

  it("$200 en 12 cuotas: sin outlier en la última (8 cuotas de 16,67 y 4 de 16,66)", () => {
    // 20000 / 12 = 1666 resto 8 → las primeras 8 cuotas suman 1 centavo
    const result = generateInstallments({
      ...base,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 12,
      totalAmountCents: 20000n,
    });
    const amounts = result.map((r) => r.amountCents);
    expect(amounts.filter((a) => a === 1667n)).toHaveLength(8);
    expect(amounts.filter((a) => a === 1666n)).toHaveLength(4);
    expect(amounts.reduce((acc, a) => acc + a, 0n)).toBe(20000n);
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

  it("vencimiento posterior al cierre, mismo mes (dueDay > closingDay): no se va de más", () => {
    // Cierre 5, vencimiento 20 → el pago cae el mismo mes del cierre.
    const antesDelCierre = generateInstallments({
      cardClosingDay: 5,
      cardDueDay: 20,
      currency: "ARS",
      purchaseDate: new Date("2025-06-03"),
      totalInstallments: 1,
      totalAmountCents: 1000n,
    });
    // Compra antes del 5 → cierra en junio → primer pago en JUNIO (no julio/agosto).
    expect(antesDelCierre[0].dueDate.getMonth()).toBe(5); // junio (0-indexed)

    const despuesDelCierre = generateInstallments({
      cardClosingDay: 5,
      cardDueDay: 20,
      currency: "ARS",
      purchaseDate: new Date("2025-06-10"),
      totalInstallments: 1,
      totalAmountCents: 1000n,
    });
    // Compra después del 5 → cierra en julio → primer pago en JULIO (no agosto).
    expect(despuesDelCierre[0].dueDate.getMonth()).toBe(6); // julio
  });

  it("si el vencimiento cae fin de semana, se corre al lunes", () => {
    // Cierre 20, compra 15/ene → primer vencimiento en febrero.
    // Día 8 de feb/2025 es sábado → debe moverse al lunes 10.
    const result = generateInstallments({
      ...base,
      cardDueDay: 8,
      purchaseDate: new Date("2025-01-15"),
      totalInstallments: 1,
      totalAmountCents: 1000n,
    });
    expect(result[0].dueDate.getMonth()).toBe(1); // febrero
    expect(result[0].dueDate.getDate()).toBe(10); // corrido de sáb 8 a lun 10
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

describe("impliedMonthlyRate (TEM derivada del recargo, RF-3.5)", () => {
  it("sin recargo (financiado = original) ⇒ 0", () => {
    expect(impliedMonthlyRate(10000n, 10000n, 6)).toBe(0);
  });

  it("financiado menor al original ⇒ 0 (no inventamos tasa negativa)", () => {
    expect(impliedMonthlyRate(10000n, 9000n, 6)).toBe(0);
  });

  it("1 cuota: la tasa es el recargo directo (final/original − 1)", () => {
    // 11000 / 10000 = 1,10 ⇒ 10 % en el único período
    expect(impliedMonthlyRate(10000n, 11000n, 1)).toBeCloseTo(10, 1);
  });

  it("N cuotas: recupera la TEM del sistema francés", () => {
    // 10000 al 10 % mensual en 12 cuotas (francés) ⇒ cuota ≈ 1467,6 ⇒ total ≈ 17612
    expect(impliedMonthlyRate(10000n, 17612n, 12)).toBeCloseTo(10, 1);
  });

  it("a mayor recargo, mayor TEM (monotonía)", () => {
    const baja = impliedMonthlyRate(10000n, 11000n, 6);
    const alta = impliedMonthlyRate(10000n, 13000n, 6);
    expect(baja).toBeGreaterThan(0);
    expect(alta).toBeGreaterThan(baja);
  });
});

describe("generateInstallments con total financiado (con recargo)", () => {
  const base = {
    cardClosingDay: 20,
    cardDueDay: 10,
    purchaseDate: new Date("2025-01-15"),
    currency: "ARS" as const,
  };

  it("reparte el total final con el sobrante en las primeras cuotas", () => {
    // Total financiado 11576 en 3 ⇒ base 3858 resto 2 ⇒ 3859 + 3859 + 3858
    const result = generateInstallments({
      ...base,
      totalInstallments: 3,
      totalAmountCents: 11576n,
    });
    expect(result.map((r) => r.amountCents)).toEqual([3859n, 3859n, 3858n]);
    const total = result.reduce((acc, r) => acc + r.amountCents, 0n);
    expect(total).toBe(11576n);
  });

  it("la suma de cuotas iguala exactamente el total financiado (24 cuotas)", () => {
    const financed = 1_333_330n;
    const result = generateInstallments({
      ...base,
      totalInstallments: 24,
      totalAmountCents: financed,
    });
    const total = result.reduce((acc, r) => acc + r.amountCents, 0n);
    expect(total).toBe(financed);
    expect(result).toHaveLength(24);
  });
});
