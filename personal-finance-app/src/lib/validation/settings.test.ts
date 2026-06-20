import { describe, it, expect } from "vitest";
import { incomeSchema, savingsSchema } from "./settings";

describe("incomeSchema — ingreso por moneda", () => {
  it("acepta solo la moneda principal (ingreso opcional)", () => {
    // El ingreso pasó a ser opcional por moneda: se puede guardar solo la moneda
    // principal y cargar el ingreso después (o tener solo ahorro).
    expect(incomeSchema.safeParse({ defaultCurrency: "ARS" }).success).toBe(true);
  });

  it("acepta ingreso en ARS y USD", () => {
    const result = incomeSchema.safeParse({
      defaultCurrency: "ARS",
      incomeArs: 1_500_000,
      incomeUsd: 1200,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un ingreso negativo", () => {
    const result = incomeSchema.safeParse({ defaultCurrency: "ARS", incomeArs: -1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/negativo/i);
  });

  it("rechaza una moneda principal inválida", () => {
    expect(incomeSchema.safeParse({ defaultCurrency: "EUR" }).success).toBe(false);
  });
});

describe("savingsSchema — saldo de ahorro", () => {
  it("acepta saldos por moneda y también vacío", () => {
    expect(savingsSchema.safeParse({}).success).toBe(true);
    expect(savingsSchema.safeParse({ savingsArs: 0, savingsUsd: 500 }).success).toBe(true);
  });

  it("rechaza un saldo negativo", () => {
    const result = savingsSchema.safeParse({ savingsArs: -100 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/negativo/i);
  });
});
