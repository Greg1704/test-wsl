import { describe, it, expect } from "vitest";

import { buildMonthlyReport, hasDebtThisMonth } from "./monthly-report";
import type { MonthlyOverview } from "@/server/queries/monthly-overview";

// Helper para armar un overview mínimo en los tests.
function overview(currencies: MonthlyOverview["currencies"]): MonthlyOverview {
  return { defaultCurrency: "ARS", hasIncome: true, overdueCount: 0, currencies };
}

describe("monthly-report", () => {
  describe("hasDebtThisMonth", () => {
    it("true si alguna moneda tiene cuotas comprometidas", () => {
      const o = overview([
        { currency: "ARS", committedCents: 50000n, nextDue: null, incomeCents: null, netCents: null },
      ]);
      expect(hasDebtThisMonth(o)).toBe(true);
    });

    it("false si ninguna moneda tiene cuotas en el mes", () => {
      const o = overview([
        { currency: "ARS", committedCents: 0n, nextDue: null, incomeCents: 100000n, netCents: 100000n },
      ]);
      expect(hasDebtThisMonth(o)).toBe(false);
    });

    it("false sin monedas", () => {
      expect(hasDebtThisMonth(overview([]))).toBe(false);
    });
  });

  describe("buildMonthlyReport", () => {
    const month = new Date(2026, 5, 1); // junio 2026 (componentes locales)

    it("incluye solo las monedas con cuotas comprometidas", () => {
      const o = overview([
        { currency: "ARS", committedCents: 50000n, nextDue: null, incomeCents: null, netCents: null },
        { currency: "USD", committedCents: 0n, nextDue: null, incomeCents: 100000n, netCents: 100000n },
      ]);
      const report = buildMonthlyReport(o, month);
      expect(report.lines).toHaveLength(1);
      expect(report.lines[0].currency).toBe("ARS");
    });

    it("formatea montos por moneda y arma el asunto con el mes", () => {
      const o = overview([
        {
          currency: "ARS",
          committedCents: 123456n,
          nextDue: { dueDate: new Date(2026, 5, 10), amountCents: 41152n },
          incomeCents: 500000n,
          netCents: 376544n,
        },
      ]);
      const report = buildMonthlyReport(o, month);
      expect(report.subject).toContain("junio 2026");
      const line = report.lines[0];
      expect(line.committed).toContain("1.234,56");
      expect(line.income).toContain("5.000,00");
      expect(line.net).toContain("3.765,44");
      expect(line.netNegative).toBe(false);
      expect(line.nextDue?.amount).toContain("411,52");
    });

    it("marca netNegative cuando las cuotas superan el ingreso", () => {
      const o = overview([
        { currency: "ARS", committedCents: 200000n, nextDue: null, incomeCents: 100000n, netCents: -100000n },
      ]);
      const report = buildMonthlyReport(o, month);
      expect(report.lines[0].netNegative).toBe(true);
    });

    it("income/net en null cuando no hay ingreso configurado", () => {
      const o = overview([
        { currency: "ARS", committedCents: 50000n, nextDue: null, incomeCents: null, netCents: null },
      ]);
      const report = buildMonthlyReport(o, month);
      expect(report.lines[0].income).toBeNull();
      expect(report.lines[0].net).toBeNull();
      expect(report.lines[0].netNegative).toBe(false);
    });
  });
});
