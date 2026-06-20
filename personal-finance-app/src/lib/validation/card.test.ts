import { describe, it, expect, vi, afterEach } from "vitest";
import { cardSchema } from "./card";

const base = {
  type: "CREDIT" as const,
  name: "Visa Galicia",
  bank: "Galicia",
  last4: "1234",
  closingDay: 20,
  dueDay: 10,
  currency: "ARS" as const,
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
