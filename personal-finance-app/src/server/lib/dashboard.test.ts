import { describe, it, expect } from "vitest";
import {
  buildCategoryBreakdown,
  buildProjection,
  groupInstallmentsByDate,
  percentOfIncome,
  type ProjectionRow,
} from "./dashboard";

describe("groupInstallmentsByDate", () => {
  // Fechas con componentes locales (new Date(año, mesIndex, día)) para no depender
  // de la TZ del runner.
  const row = (id: string, dueDate: Date) => ({ id, dueDate });

  it("agrupa por día de vencimiento y ordena cronológicamente", () => {
    const rows = [
      row("a", new Date(2026, 6, 20)),
      row("b", new Date(2026, 6, 10)),
      row("c", new Date(2026, 6, 10)),
    ];
    const groups = groupInstallmentsByDate(rows);

    expect(groups).toHaveLength(2);
    // El día 10 va antes que el 20, sin importar el orden de entrada.
    expect(groups[0].date.getDate()).toBe(10);
    expect(groups[0].items.map((i) => i.id)).toEqual(["b", "c"]);
    expect(groups[1].date.getDate()).toBe(20);
    expect(groups[1].items.map((i) => i.id)).toEqual(["a"]);
  });

  it("distingue el mismo día en meses distintos", () => {
    const groups = groupInstallmentsByDate([
      row("jul", new Date(2026, 6, 10)),
      row("ago", new Date(2026, 7, 10)),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("lista vacía → sin grupos", () => {
    expect(groupInstallmentsByDate([])).toEqual([]);
  });
});

describe("buildProjection", () => {
  // Filas con componentes locales para no depender de la TZ del runner.
  const row = (over: Partial<ProjectionRow>): ProjectionRow => ({
    dueDate: new Date(2026, 5, 10),
    amountCents: 1000n,
    currency: "ARS",
    cardId: "visa",
    cardName: "Visa Galicia",
    ...over,
  });
  const june = new Date(2026, 5, 1);

  it("zero-fill: devuelve exactamente monthCount meses aunque no haya cuotas en todos", () => {
    const [serie] = buildProjection([row({})], june, 12);
    expect(serie.months).toHaveLength(12);
    expect(serie.months[0].month).toEqual(new Date(2026, 5, 1));
    expect(serie.months[11].month).toEqual(new Date(2027, 4, 1));
    // Solo junio tiene monto; el resto queda en 0.
    expect(serie.months[0].totalCents).toBe(1000n);
    expect(serie.months.slice(1).every((m) => m.totalCents === 0n)).toBe(true);
  });

  it("acumula por mes y desglosa por tarjeta", () => {
    const rows = [
      row({ amountCents: 1000n }),
      row({ amountCents: 500n, cardId: "amex", cardName: "Amex" }),
      row({ amountCents: 700n, dueDate: new Date(2026, 6, 10) }),
    ];
    const [serie] = buildProjection(rows, june, 12);
    expect(serie.months[0].totalCents).toBe(1500n);
    expect(serie.months[0].byCard).toEqual({ visa: 1000n, amex: 500n });
    expect(serie.months[1].totalCents).toBe(700n);
  });

  it("ordena las tarjetas por total comprometido descendente", () => {
    const rows = [
      row({ amountCents: 500n }),
      row({ amountCents: 2000n, cardId: "amex", cardName: "Amex" }),
    ];
    const [serie] = buildProjection(rows, june, 6);
    expect(serie.cards.map((c) => c.id)).toEqual(["amex", "visa"]);
  });

  it("separa monedas en series distintas, nunca las suma (RF-9.1)", () => {
    const rows = [row({}), row({ currency: "USD", amountCents: 300n })];
    const series = buildProjection(rows, june, 3);
    expect(series).toHaveLength(2);
    const ars = series.find((s) => s.currency === "ARS")!;
    const usd = series.find((s) => s.currency === "USD")!;
    expect(ars.months[0].totalCents).toBe(1000n);
    expect(usd.months[0].totalCents).toBe(300n);
  });

  it("ignora cuotas fuera del horizonte (antes y después)", () => {
    const rows = [
      row({ dueDate: new Date(2026, 4, 10) }), // mes anterior
      row({ dueDate: new Date(2027, 5, 10) }), // mes 13
      row({}),
    ];
    const [serie] = buildProjection(rows, june, 12);
    const total = serie.months.reduce((acc, m) => acc + m.totalCents, 0n);
    expect(total).toBe(1000n);
  });

  it("sin filas → sin series", () => {
    expect(buildProjection([], june, 12)).toEqual([]);
  });
});

describe("buildCategoryBreakdown", () => {
  const cat = (id: string, name: string) => ({ id, name, color: "#22c55e" });

  it("agrupa por categoría y ordena por monto descendente", () => {
    const rows = [
      { amountCents: 100n, currency: "ARS", category: cat("a", "Super") },
      { amountCents: 900n, currency: "ARS", category: cat("b", "Viajes") },
      { amountCents: 200n, currency: "ARS", category: cat("a", "Super") },
    ];
    const [b] = buildCategoryBreakdown(rows);
    expect(b.slices.map((s) => s.name)).toEqual(["Viajes", "Super"]);
    expect(b.slices[1].amountCents).toBe(300n);
  });

  it("compras sin categoría caen en 'Sin categoría'", () => {
    const rows = [
      { amountCents: 100n, currency: "ARS", category: null },
      { amountCents: 50n, currency: "ARS", category: null },
    ];
    const [b] = buildCategoryBreakdown(rows);
    expect(b.slices).toHaveLength(1);
    expect(b.slices[0]).toMatchObject({ id: null, name: "Sin categoría", amountCents: 150n });
  });

  it("separa monedas (RF-9.1)", () => {
    const rows = [
      { amountCents: 100n, currency: "ARS", category: cat("a", "Super") },
      { amountCents: 100n, currency: "USD", category: cat("a", "Super") },
    ];
    expect(buildCategoryBreakdown(rows)).toHaveLength(2);
  });
});

describe("percentOfIncome", () => {
  it("calcula el porcentaje con 1 decimal", () => {
    // 32.550 de 100.000 → 32.5%
    expect(percentOfIncome(32_550_00n, 100_000_00n)).toBe(32.5);
  });

  it("puede superar 100 cuando las cuotas exceden el ingreso", () => {
    expect(percentOfIncome(150_000_00n, 100_000_00n)).toBe(150);
  });

  it("sin ingreso (null o 0) → null", () => {
    expect(percentOfIncome(1000n, null)).toBeNull();
    expect(percentOfIncome(1000n, 0n)).toBeNull();
  });
});
