import { describe, it, expect } from "vitest";

import {
  utilizationPercent,
  utilizationLevel,
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
