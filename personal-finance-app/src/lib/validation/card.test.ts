import { describe, it, expect, vi, afterEach } from "vitest";
import { cardSchema } from "./card";

const base = {
  type: "CREDIT" as const,
  name: "Visa Galicia",
  bank: "Galicia",
  last4: "1234",
  closingDay: 20,
  dueDay: 10,
  currencies: ["ARS"] as const,
  creditLimit: 2_000_000,
};

describe("cardSchema — vencimiento", () => {
  afterEach(() => vi.useRealTimers());

  it("rechaza una tarjeta con vencimiento en el pasado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // junio 2026

    const result = cardSchema.safeParse({ ...base, expiration: "01/20" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/vencida/i);
  });

  it("acepta un vencimiento futuro", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));

    expect(cardSchema.safeParse({ ...base, expiration: "08/30" }).success).toBe(true);
  });

  it("acepta el mes en curso (la tarjeta vale hasta fin de mes)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // 15/06/2026

    expect(cardSchema.safeParse({ ...base, expiration: "06/26" }).success).toBe(true);
  });

  it("reporta formato inválido sin romper", () => {
    const result = cardSchema.safeParse({ ...base, expiration: "13/99" });
    expect(result.success).toBe(false);
  });
});

describe("cardSchema — monedas", () => {
  const credit = { ...base, expiration: "08/30" };

  it("acepta una tarjeta multi-moneda (ARS y USD)", () => {
    const result = cardSchema.safeParse({ ...credit, currencies: ["ARS", "USD"] });
    expect(result.success).toBe(true);
    expect(result.data?.currencies).toEqual(["ARS", "USD"]);
  });

  it("rechaza una tarjeta sin monedas", () => {
    const result = cardSchema.safeParse({ ...credit, currencies: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/al menos una moneda/i);
  });

  it("deduplica monedas repetidas", () => {
    const result = cardSchema.safeParse({ ...credit, currencies: ["ARS", "ARS"] });
    expect(result.success).toBe(true);
    expect(result.data?.currencies).toEqual(["ARS"]);
  });
});

describe("cardSchema — límite de crédito", () => {
  const credit = { ...base, expiration: "08/30" };

  it("exige el límite en una tarjeta de crédito", () => {
    const withoutLimit = { ...credit, creditLimit: undefined };
    const result = cardSchema.safeParse(withoutLimit);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => /límite de crédito es requerido/i.test(i.message))).toBe(
      true
    );
  });

  it("rechaza un límite de 0 o negativo", () => {
    expect(cardSchema.safeParse({ ...credit, creditLimit: 0 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...credit, creditLimit: -100 }).success).toBe(false);
  });

  it("acepta un límite positivo", () => {
    const result = cardSchema.safeParse({ ...credit, creditLimit: 3_000_000 });
    expect(result.success).toBe(true);
    expect(result.data?.creditLimit).toBe(3_000_000);
  });

  it("no exige límite en una tarjeta de débito", () => {
    const result = cardSchema.safeParse({
      type: "DEBIT",
      name: "Visa Débito",
      bank: "Galicia",
      last4: "1234",
      currencies: ["ARS"],
    });
    expect(result.success).toBe(true);
  });
});
