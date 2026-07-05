import { describe, it, expect } from "vitest";

import {
  expandSubscriptions,
  type SubscriptionDef,
  type ChargeOverride,
} from "./subscriptions";

// Los @db.Date vuelven del driver como medianoche UTC; los construimos igual (ISO date).
// Estos tests ASUMEN runtime UTC (invariante del proyecto, ver docs/ARCHITECTURE.md).
const d = (iso: string) => new Date(iso);
const ymd = (date: Date) => date.toISOString().slice(0, 10);

const def = (over: Partial<SubscriptionDef> = {}): SubscriptionDef => ({
  id: "s1",
  name: "Netflix",
  amountCents: 999900n,
  currency: "ARS",
  paymentMethod: "CREDIT",
  cardId: "c1",
  firstChargeDate: d("2026-06-07"),
  endDate: null,
  limitRate: null,
  ...over,
});

describe("expandSubscriptions", () => {
  it("genera un cobro por mes en el día de firstChargeDate", () => {
    const occ = expandSubscriptions([def()], [], d("2026-06-01"), d("2026-08-01"));
    expect(occ.map((o) => ymd(o.dueDate))).toEqual([
      "2026-06-07",
      "2026-07-07",
      "2026-08-07",
    ]);
    expect(occ.every((o) => o.status === "PENDING")).toBe(true);
    expect(occ.every((o) => o.amountCents === 999900n)).toBe(true);
    // periodMonth siempre es el primer día del mes.
    expect(occ.map((o) => ymd(o.periodMonth))).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
  });

  it("clampea el día al último del mes en meses cortos (cobro el 31 → 28 de febrero)", () => {
    const occ = expandSubscriptions(
      [def({ firstChargeDate: d("2026-01-31") })],
      [],
      d("2026-01-01"),
      d("2026-03-01")
    );
    // 2026 no es bisiesto → febrero 28.
    expect(occ.map((o) => ymd(o.dueDate))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("respeta el 29 de febrero en año bisiesto", () => {
    const occ = expandSubscriptions(
      [def({ firstChargeDate: d("2024-01-31") })],
      [],
      d("2024-02-01"),
      d("2024-02-01")
    );
    expect(occ.map((o) => ymd(o.dueDate))).toEqual(["2024-02-29"]);
  });

  it("no genera cobros antes de firstChargeDate aunque la ventana empiece antes", () => {
    const occ = expandSubscriptions([def()], [], d("2026-01-01"), d("2026-08-01"));
    expect(occ.map((o) => ymd(o.periodMonth))).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
  });

  it("corta en endDate (baja inclusive: cobra el mes de endDate, no después)", () => {
    const occ = expandSubscriptions(
      [def({ endDate: d("2026-08-15") })],
      [],
      d("2026-06-01"),
      d("2026-12-01")
    );
    expect(occ.map((o) => ymd(o.periodMonth))).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
  });

  it("devuelve vacío si la suscripción no está activa en la ventana", () => {
    const occ = expandSubscriptions([def()], [], d("2026-01-01"), d("2026-05-01"));
    expect(occ).toEqual([]);
  });

  it("aplica overrides PAID y SKIPPED conservando el resto en PENDING", () => {
    const overrides: ChargeOverride[] = [
      {
        subscriptionId: "s1",
        periodMonth: d("2026-06-01"),
        status: "PAID",
        paidFromSavings: true,
        amountCentsOverride: null,
      },
      {
        subscriptionId: "s1",
        periodMonth: d("2026-07-01"),
        status: "SKIPPED",
        paidFromSavings: true,
        amountCentsOverride: null,
      },
    ];
    const occ = expandSubscriptions([def()], overrides, d("2026-06-01"), d("2026-08-01"));
    expect(occ.map((o) => o.status)).toEqual(["PAID", "SKIPPED", "PENDING"]);
    // El monto del cobro pagado sigue siendo el de la definición (sin override de monto).
    expect(occ[0].amountCents).toBe(999900n);
    expect(occ[0].paidFromSavings).toBe(true);
  });

  it("usa amountCentsOverride cuando un mes salió distinto", () => {
    const overrides: ChargeOverride[] = [
      {
        subscriptionId: "s1",
        periodMonth: d("2026-07-01"),
        status: "PAID",
        paidFromSavings: false,
        amountCentsOverride: 1250000n,
      },
    ];
    const occ = expandSubscriptions([def()], overrides, d("2026-07-01"), d("2026-07-01"));
    expect(occ[0].amountCents).toBe(1250000n);
    expect(occ[0].paidFromSavings).toBe(false);
  });

  it("expande varias suscripciones y arrastra su moneda/medio/tarjeta", () => {
    const subs = [
      def({ id: "s1", currency: "ARS", paymentMethod: "CREDIT", cardId: "c1" }),
      def({
        id: "s2",
        name: "Spotify",
        currency: "USD",
        paymentMethod: "DEBIT",
        cardId: null,
        firstChargeDate: d("2026-06-20"),
      }),
    ];
    const occ = expandSubscriptions(subs, [], d("2026-06-01"), d("2026-06-01"));
    expect(occ).toHaveLength(2);
    const s2 = occ.find((o) => o.subscriptionId === "s2")!;
    expect(s2.currency).toBe("USD");
    expect(s2.paymentMethod).toBe("DEBIT");
    expect(s2.cardId).toBeNull();
    expect(ymd(s2.dueDate)).toBe("2026-06-20");
  });
});
