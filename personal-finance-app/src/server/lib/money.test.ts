import { describe, it, expect } from "vitest";
import { centsToCurrency, currencyToCents, formatMoney } from "./money";

describe("money", () => {
  describe("currencyToCents", () => {
    it("convierte unidades a centavos", () => {
      expect(currencyToCents(1234.56)).toBe(123456n);
    });

    it("maneja montos con un solo decimal", () => {
      expect(currencyToCents(1234.5)).toBe(123450n);
    });

    it("redondea al centavo más cercano", () => {
      expect(currencyToCents(10.999)).toBe(1100n);
    });

    it("0 → 0n", () => {
      expect(currencyToCents(0)).toBe(0n);
    });
  });

  describe("centsToCurrency", () => {
    it("convierte centavos a unidades", () => {
      expect(centsToCurrency(123456n)).toBe(1234.56);
    });

    it("0n → 0", () => {
      expect(centsToCurrency(0n)).toBe(0);
    });

    it("round-trip estable para montos muy grandes", () => {
      const cents = 100_000_000_000n; // $1.000.000.000,00
      expect(currencyToCents(centsToCurrency(cents))).toBe(cents);
    });
  });

  describe("formatMoney", () => {
    it("formatea ARS con locale es-AR (miles con '.', decimales con ',')", () => {
      const out = formatMoney(123456n);
      expect(out).toContain("1.234,56");
      expect(out).toMatch(/\$/);
    });

    it("formatea USD de forma distinguible de ARS", () => {
      const out = formatMoney(123456n, "USD");
      expect(out).toContain("1.234,56");
      expect(out).toContain("US$");
    });

    it("ARS por defecto cuando no se pasa currency", () => {
      expect(formatMoney(123456n)).not.toContain("US$");
    });

    it("cero", () => {
      expect(formatMoney(0n)).toContain("0,00");
    });

    it("montos muy grandes con separador de miles", () => {
      expect(formatMoney(100_000_000_000n)).toContain("1.000.000.000,00");
    });
  });
});
