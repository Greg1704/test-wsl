import { describe, it, expect } from "vitest";
import { generateInstallments } from "./installments";

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
