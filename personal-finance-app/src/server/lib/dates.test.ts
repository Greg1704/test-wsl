import { describe, it, expect, vi, afterEach } from "vitest";
import {
  addMonths,
  formatDate,
  formatMonthYear,
  getDate,
  setDate,
  nextBusinessDay,
  parseExpiration,
  formatExpiration,
  isCardExpired,
  monthParamToDate,
  monthRange,
} from "./dates";

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

  describe("nextBusinessDay", () => {
    it("sábado → lunes siguiente", () => {
      // 8 de febrero de 2025 es sábado → 10 (lunes)
      const lunes = nextBusinessDay(new Date(2025, 1, 8));
      expect(getDate(lunes)).toBe(10);
    });

    it("domingo → lunes siguiente", () => {
      // 9 de febrero de 2025 es domingo → 10 (lunes)
      const lunes = nextBusinessDay(new Date(2025, 1, 9));
      expect(getDate(lunes)).toBe(10);
    });

    it("día hábil queda igual", () => {
      // 10 de febrero de 2025 es lunes → sin cambios
      const igual = nextBusinessDay(new Date(2025, 1, 10));
      expect(getDate(igual)).toBe(10);
    });
  });

  describe("vencimiento de tarjeta (MM/AA)", () => {
    afterEach(() => vi.useRealTimers());

    it("parseExpiration → último día del mes", () => {
      const d = parseExpiration("08/27");
      expect(d.getFullYear()).toBe(2027);
      expect(d.getMonth()).toBe(7); // agosto (0-indexed)
      expect(d.getDate()).toBe(31);
    });

    it("parseExpiration y formatExpiration son ida y vuelta", () => {
      expect(formatExpiration(parseExpiration("01/30"))).toBe("01/30");
      expect(formatExpiration(parseExpiration("12/26"))).toBe("12/26");
    });

    it("isCardExpired: vigente el último día del mes, vencida al día siguiente", () => {
      // Tarjeta vence 08/2027 → válida hasta el 31/08/2027 inclusive
      const exp = parseExpiration("08/27");

      vi.useFakeTimers();
      vi.setSystemTime(new Date(2027, 7, 31, 12, 0, 0)); // 31/08/2027
      expect(isCardExpired(exp)).toBe(false);

      vi.setSystemTime(new Date(2027, 8, 1, 0, 0, 0)); // 01/09/2027
      expect(isCardExpired(exp)).toBe(true);
    });
  });

  describe("monthParamToDate / monthRange", () => {
    it("monthParamToDate: 'YYYY-MM' → primer día de ese mes", () => {
      const d = monthParamToDate("2026-06")!;
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(5); // junio (0-indexed)
      expect(d.getDate()).toBe(1);
    });

    it("monthParamToDate: undefined o inválido → undefined", () => {
      expect(monthParamToDate(undefined)).toBeUndefined();
      expect(monthParamToDate("no-es-fecha")).toBeUndefined();
    });

    it("monthRange: borde superior EXCLUSIVO (inicio del mes siguiente)", () => {
      const { gte, lt } = monthRange(new Date(2026, 5, 15)); // junio
      expect(gte.getMonth()).toBe(5); // junio
      expect(gte.getDate()).toBe(1);
      expect(lt.getMonth()).toBe(6); // julio
      expect(lt.getDate()).toBe(1);
      expect(gte.getTime()).toBeLessThan(lt.getTime());
    });

    // Regresión de zona horaria. Los `@db.Date` que filtra monthRange vuelven como
    // medianoche UTC; los bordes los arma con `startOfMonth` (hora local). Asume
    // runtime UTC (invariante en ARCHITECTURE, "Zona horaria del runtime"): bajo una
    // TZ negativa el día 1 se cae y se cuela el día 1 del mes siguiente, y falla.
    it("monthRange: incluye día 1 y último día; excluye el día 1 del mes siguiente", () => {
      const { gte, lt } = monthRange(monthParamToDate("2026-06")!);
      const dbDate = (s: string) => new Date(`${s}T00:00:00Z`); // como un @db.Date
      const inRange = (d: Date) => d >= gte && d < lt;

      expect(inRange(dbDate("2026-06-01"))).toBe(true); // primer día propio
      expect(inRange(dbDate("2026-06-30"))).toBe(true); // último día propio
      expect(inRange(dbDate("2026-05-31"))).toBe(false); // mes anterior
      expect(inRange(dbDate("2026-07-01"))).toBe(false); // mes siguiente, NO se cuela
    });
  });
});
