import { describe, it, expect } from "vitest";
import { incomeSchema } from "./settings";

describe("incomeSchema — ingreso mensual", () => {
  it("rechaza el ingreso vacío (sin valor) con 'Ingresá un monto'", () => {
    // El input vacío llega como `undefined` al guardar.
    const result = incomeSchema.safeParse({ defaultCurrency: "ARS" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/ingresá un monto/i);
  });

  it("rechaza 0 (no es un sueldo real) con 'mayor a 0'", () => {
    const result = incomeSchema.safeParse({ monthlyIncome: 0, defaultCurrency: "ARS" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/mayor a 0/i);
  });

  it("rechaza un ingreso negativo", () => {
    const result = incomeSchema.safeParse({ monthlyIncome: -1, defaultCurrency: "ARS" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/mayor a 0/i);
  });

  it("acepta un ingreso válido", () => {
    const result = incomeSchema.safeParse({ monthlyIncome: 1_500_000, defaultCurrency: "USD" });
    expect(result.success).toBe(true);
  });
});
