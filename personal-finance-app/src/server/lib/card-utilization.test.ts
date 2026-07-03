import { describe, it, expect } from "vitest";

import {
  utilizationPercent,
  utilizationLevel,
  convertCents,
  projectUtilization,
  WARNING_THRESHOLD,
} from "./card-utilization";

describe("utilizationPercent", () => {
  it("calcula el porcentaje usado del límite", () => {
    // $13.600 usados de $20.000 → 68 %
    expect(utilizationPercent(1_360_000n, 2_000_000n)).toBe(68);
  });

  it("mantiene 1 decimal sin perder precisión (entero-safe)", () => {
    // 1 de 3 → 33.3 %
    expect(utilizationPercent(1_000_00n, 3_000_00n)).toBe(33.3);
  });

  it("puede superar el 100 % si te excediste del límite", () => {
    expect(utilizationPercent(2_500_000n, 2_000_000n)).toBe(125);
  });

  it("es 0 sin uso", () => {
    expect(utilizationPercent(0n, 2_000_000n)).toBe(0);
  });

  it("devuelve 0 (no divide por cero) si el límite es 0 o negativo", () => {
    expect(utilizationPercent(1_000_00n, 0n)).toBe(0);
    expect(utilizationPercent(1_000_00n, -5n)).toBe(0);
  });
});

describe("utilizationLevel", () => {
  it("ok por debajo del umbral", () => {
    expect(utilizationLevel(0)).toBe("ok");
    expect(utilizationLevel(WARNING_THRESHOLD - 0.1)).toBe("ok");
  });

  it("warning entre el umbral y el 100 %", () => {
    expect(utilizationLevel(WARNING_THRESHOLD)).toBe("warning");
    expect(utilizationLevel(100)).toBe("warning");
  });

  it("over por encima del 100 %", () => {
    expect(utilizationLevel(100.1)).toBe("over");
    expect(utilizationLevel(150)).toBe("over");
  });
});

describe("convertCents", () => {
  it("convierte USD→ARS con la cotización snapshot", () => {
    // US$100,00 (10000 centavos USD) a $1.200 → $120.000,00 = 12_000_000 centavos ARS
    expect(convertCents(10_000n, "1200")).toBe(12_000_000n);
  });

  it("usa la parte decimal de la tasa (Decimal(18,6))", () => {
    // 10000 * 1200.5 = 12_005_000
    expect(convertCents(10_000n, "1200.5")).toBe(12_005_000n);
  });

  it("redondea al centavo (medio hacia arriba)", () => {
    // 3 * 1.333333 = 3.999999 → redondea a 4
    expect(convertCents(3n, "1.333333")).toBe(4n);
    // 1 * 1.4999995 (recortado a 6 dec = 1.499999) = 1.499999 → 1
    expect(convertCents(1n, "1.4999995")).toBe(1n);
  });

  it("es 0 si el monto es 0", () => {
    expect(convertCents(0n, "1200")).toBe(0n);
  });
});

describe("projectUtilization", () => {
  it("suma la compra en la misma moneda del límite", () => {
    // Usado $8.000 de $20.000 (40%); compra $6.000 → $14.000 (70%).
    const p = projectUtilization({
      currentUsedCents: 800_000n,
      limitCents: 2_000_000n,
      addedCents: 600_000n,
      sameCurrency: true,
    });
    expect(p).not.toBeNull();
    expect(p!.beforePercent).toBe(40);
    expect(p!.afterPercent).toBe(70);
    expect(p!.afterUsedCents).toBe(1_400_000n);
    expect(p!.afterLevel).toBe("ok");
  });

  it("convierte la compra a la moneda del límite con la tasa", () => {
    // Límite $2.000.000 ARS, usado 0; compra US$100 (10000c) × 1500 = $150.000 ARS → 7,5%.
    const p = projectUtilization({
      currentUsedCents: 0n,
      limitCents: 200_000_000n,
      addedCents: 10_000n,
      sameCurrency: false,
      rate: 1500,
    });
    expect(p!.addedCents).toBe(15_000_000n);
    expect(p!.afterPercent).toBe(7.5);
  });

  it("marca warning/over al cruzar los umbrales", () => {
    const warn = projectUtilization({
      currentUsedCents: 1_400_000n,
      limitCents: 2_000_000n,
      addedCents: 200_000n, // 70% → 80%
      sameCurrency: true,
    });
    expect(warn!.afterLevel).toBe("warning");
    const over = projectUtilization({
      currentUsedCents: 1_800_000n,
      limitCents: 2_000_000n,
      addedCents: 500_000n, // 90% → 115%
      sameCurrency: true,
    });
    expect(over!.afterPercent).toBe(115);
    expect(over!.afterLevel).toBe("over");
  });

  it("devuelve null si falta la cotización en otra moneda", () => {
    const base = { currentUsedCents: 0n, limitCents: 200_000_000n, addedCents: 10_000n };
    expect(projectUtilization({ ...base, sameCurrency: false })).toBeNull();
    expect(projectUtilization({ ...base, sameCurrency: false, rate: 0 })).toBeNull();
  });
});
