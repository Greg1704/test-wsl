import { describe, it, expect } from "vitest";
import { addMonths, formatDate, formatMonthYear, getDate, setDate } from "./dates";

describe("dates", () => {
  describe("formatDate", () => {
    it("formatea en español con el patrón por defecto", () => {
      expect(formatDate(new Date(2025, 0, 15))).toBe("15 ene 2025");
    });

    it("acepta un patrón custom", () => {
      expect(formatDate(new Date(2025, 0, 15), "dd/MM/yyyy")).toBe("15/01/2025");
    });
  });

  describe("formatMonthYear", () => {
    it("mes y año en español", () => {
      expect(formatMonthYear(new Date(2025, 0, 15))).toBe("enero 2025");
    });

    it("borde de fin de año", () => {
      expect(formatMonthYear(new Date(2025, 11, 31))).toBe("diciembre 2025");
    });
  });

  describe("re-exports de date-fns", () => {
    it("addMonths cruza el cambio de año correctamente", () => {
      const d = addMonths(new Date(2025, 11, 20), 1);
      expect(formatMonthYear(d)).toBe("enero 2026");
    });

    it("getDate y setDate operan sobre el día del mes", () => {
      expect(getDate(new Date(2025, 0, 15))).toBe(15);
      expect(getDate(setDate(new Date(2025, 0, 15), 10))).toBe(10);
    });
  });
});
