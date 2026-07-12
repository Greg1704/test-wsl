import { describe, it, expect } from "vitest";

import {
  incomeForMonth,
  computeSavings,
  buildSavingsProjection,
  type SavingsInput,
} from "./savings";

// Fechas con componentes LOCALES (mes 0-indexado), igual que las usa el dashboard.
const m = (year: number, month1to12: number, day = 1) =>
  new Date(year, month1to12 - 1, day);

describe("incomeForMonth", () => {
  const entries = [
    { amountCents: 30_000n, validFrom: m(2026, 1) },
    { amountCents: 60_000n, validFrom: m(2026, 4) },
  ];

  it("toma la entrada vigente (mayor validFrom <= month)", () => {
    expect(incomeForMonth(entries, m(2026, 1))).toBe(30_000n);
    expect(incomeForMonth(entries, m(2026, 3))).toBe(30_000n); // abril aún no vigente
    expect(incomeForMonth(entries, m(2026, 4))).toBe(60_000n);
    expect(incomeForMonth(entries, m(2026, 12))).toBe(60_000n);
  });

  it("congela los meses pasados con su valor histórico", () => {
    // Marzo siempre vale 30.000 aunque después se haya subido el ingreso.
    expect(incomeForMonth(entries, m(2026, 2))).toBe(30_000n);
  });

  it("devuelve 0 antes de la primera entrada y sin entradas", () => {
    expect(incomeForMonth(entries, m(2025, 12))).toBe(0n);
    expect(incomeForMonth([], m(2026, 6))).toBe(0n);
  });
});

describe("computeSavings", () => {
  const base = (over: Partial<SavingsInput> = {}): SavingsInput => ({
    anchor: { amountCents: 100_000n, asOf: m(2026, 1) },
    incomeEntries: [{ amountCents: 50_000n, validFrom: m(2026, 1) }],
    nonCreditExpenses: [],
    savingsCuotas: [],
    month: m(2026, 3),
    committedThisMonthCents: 0n,
    ...over,
  });

  it("acumula el ingreso hacia adelante sin contar el mes del ancla", () => {
    // Feb + Mar suman 50.000 c/u sobre el ancla de enero (enero ya está en el ancla).
    const r = computeSavings(base());
    expect(r.beforeCents).toBe(200_000n);
    expect(r.afterCents).toBe(200_000n);
    expect(r.currentRealCents).toBe(200_000n);
  });

  it("resta los gastos no-crédito del mes en que ocurren", () => {
    const r = computeSavings(
      base({
        nonCreditExpenses: [{ purchaseDate: m(2026, 2, 15), amountCents: 30_000n }],
      })
    );
    // 100.000 + (50.000 − 30.000) [feb] + 50.000 [mar] = 170.000
    expect(r.beforeCents).toBe(170_000n);
  });

  it("distingue before / after / currentReal con cuotas del mes", () => {
    const r = computeSavings(
      base({
        savingsCuotas: [{ paidAt: m(2026, 3, 10), amountCents: 20_000n }],
        committedThisMonthCents: 60_000n,
      })
    );
    // Real: cuenta solo la cuota efectivamente pagada (20.000).
    expect(r.currentRealCents).toBe(180_000n);
    // Antes de cuotas: no descuenta ninguna cuota del mes (suma de vuelta la pagada).
    expect(r.beforeCents).toBe(200_000n);
    // Después: proyecta TODAS las cuotas del mes (60.000).
    expect(r.afterCents).toBe(140_000n);
  });

  it("una cuota/suscripción pagada SIN ahorros sube el 'tras cuotas'", () => {
    const withoutFlag = computeSavings(base({ committedThisMonthCents: 60_000n }));
    const withNonSavings = computeSavings(
      base({ committedThisMonthCents: 60_000n, paidNotFromSavingsThisMonthCents: 15_000n })
    );
    // Lo pagado por fuera del ahorro no lo reduce → "tras cuotas" sube esos 15.000.
    expect(withNonSavings.afterCents).toBe(withoutFlag.afterCents + 15_000n);
    // No toca `before` ni `currentReal` (no salió del ahorro).
    expect(withNonSavings.beforeCents).toBe(withoutFlag.beforeCents);
    expect(withNonSavings.currentRealCents).toBe(withoutFlag.currentRealCents);
  });

  it("descuenta un gasto del MISMO mes del ancla, posterior a asOf (regресión)", () => {
    // El usuario declara su ahorro el 2026-03-01 y gasta el 2026-03-20: el gasto debe
    // restarse aunque caiga en el mes del ancla (no quedar "absorbido" por el saldo).
    const r = computeSavings(
      base({
        anchor: { amountCents: 360_000_00n, asOf: m(2026, 3, 1) },
        incomeEntries: [{ amountCents: 0n, validFrom: m(2026, 3, 1) }],
        nonCreditExpenses: [{ purchaseDate: m(2026, 3, 20), amountCents: 4_000_00n }],
        month: m(2026, 3),
        committedThisMonthCents: 0n,
      })
    );
    expect(r.beforeCents).toBe(356_000_00n);
    expect(r.currentRealCents).toBe(356_000_00n);
  });

  it("NO descuenta un gasto anterior a asOf (ya reflejado en el saldo declarado)", () => {
    const r = computeSavings(
      base({
        anchor: { amountCents: 100_000n, asOf: m(2026, 3, 15) },
        incomeEntries: [],
        nonCreditExpenses: [{ purchaseDate: m(2026, 3, 5), amountCents: 30_000n }],
        month: m(2026, 3),
        committedThisMonthCents: 0n,
      })
    );
    expect(r.beforeCents).toBe(100_000n);
  });

  it("distingue cuotas del MISMO día por hora respecto del instante del ancla (regresión)", () => {
    // Bug real: pagás una cuota y después reanclás tus ahorros al saldo ya rebajado. Con el
    // ancla a un INSTANTE (no medianoche), la cuota pagada ANTES de reanclar queda del lado
    // "ya reflejado" (no se resta de nuevo) y la pagada DESPUÉS sí se descuenta.
    const r = computeSavings(
      base({
        anchor: { amountCents: 100_000n, asOf: new Date(2026, 2, 12, 12, 0) }, // 2026-03-12 12:00
        incomeEntries: [],
        month: m(2026, 3),
        committedThisMonthCents: 0n,
        savingsCuotas: [
          { paidAt: new Date(2026, 2, 12, 11, 50), amountCents: 20_000n }, // antes de reanclar
          { paidAt: new Date(2026, 2, 12, 12, 10), amountCents: 5_000n }, //  después de reanclar
        ],
      })
    );
    // La de las 11:50 NO se resta (ya está en los 100.000 declarados); la de las 12:10 sí.
    expect(r.currentRealCents).toBe(95_000n); // 100.000 − 5.000
    expect(r.beforeCents).toBe(100_000n);
  });

  it("sin ancla arranca de 0 desde el primer mes con actividad", () => {
    const r = computeSavings({
      anchor: null,
      incomeEntries: [{ amountCents: 50_000n, validFrom: m(2026, 1) }],
      nonCreditExpenses: [{ purchaseDate: m(2026, 2, 10), amountCents: 30_000n }],
      savingsCuotas: [],
      month: m(2026, 2),
      committedThisMonthCents: 0n,
    });
    // Ene: +50.000 ; Feb: +50.000 −30.000 = 70.000
    expect(r.currentRealCents).toBe(70_000n);
  });

  it("navega a un mes anterior al ancla restando hacia atrás", () => {
    const r = computeSavings(
      base({ anchor: { amountCents: 100_000n, asOf: m(2026, 3) }, month: m(2026, 1) })
    );
    // Ene = ancla(mar) − ingreso(feb) − ingreso(mar) = 100.000 − 50.000 − 50.000 = 0
    expect(r.currentRealCents).toBe(0n);
  });

  it("respeta el ingreso congelado al cambiar de valor a mitad de horizonte", () => {
    const r = computeSavings({
      anchor: { amountCents: 0n, asOf: m(2025, 12) },
      incomeEntries: [
        { amountCents: 30_000n, validFrom: m(2026, 1) },
        { amountCents: 60_000n, validFrom: m(2026, 4) },
      ],
      nonCreditExpenses: [],
      savingsCuotas: [],
      month: m(2026, 5),
      committedThisMonthCents: 0n,
    });
    // Ene–Mar: 30.000×3 = 90.000 ; Abr–May: 60.000×2 = 120.000 → 210.000
    expect(r.currentRealCents).toBe(210_000n);
  });

  it("proyecta el ahorro disponible mes a mes (ingreso acumula, gasto baja)", () => {
    const series = buildSavingsProjection(
      {
        anchor: { amountCents: 100_000n, asOf: m(2026, 1, 1) },
        incomeEntries: [{ amountCents: 50_000n, validFrom: m(2026, 1) }],
        nonCreditExpenses: [{ purchaseDate: m(2026, 2, 10), amountCents: 30_000n }],
        savingsCuotas: [],
      },
      m(2026, 1),
      4
    );
    expect(series.map((s) => s.beforeCents)).toEqual([
      100_000n, // ene: ancla (su ingreso ya está incluido)
      120_000n, // feb: +50.000 −30.000
      170_000n, // mar: +50.000
      220_000n, // abr: +50.000
    ]);
    // Las fechas son el primer día de cada mes consecutivo.
    expect(series[1].month.getMonth()).toBe(1); // febrero (0-indexado)
  });

  it("gasto y cuota-desde-ahorros en el mismo mes", () => {
    const r = computeSavings(
      base({
        nonCreditExpenses: [{ purchaseDate: m(2026, 3, 5), amountCents: 10_000n }],
        savingsCuotas: [{ paidAt: m(2026, 3, 20), amountCents: 25_000n }],
        committedThisMonthCents: 25_000n,
      })
    );
    // Real: 100.000 +50.000[feb] +(50.000 −10.000 −25.000)[mar] = 165.000
    expect(r.currentRealCents).toBe(165_000n);
    // Antes: real + cuota del mes (25.000) = 190.000  (el gasto sí está descontado)
    expect(r.beforeCents).toBe(190_000n);
    // Después: antes − todas las cuotas del mes (25.000) = 165.000
    expect(r.afterCents).toBe(165_000n);
  });
});
