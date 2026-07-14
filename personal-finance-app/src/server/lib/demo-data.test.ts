import { describe, it, expect, vi } from "vitest";

import {
  DEMO_EMAIL_DOMAIN,
  DEMO_EMAIL_PREFIX,
  isDemoEmail,
  seedDemoData,
} from "./demo-data";
import { DEFAULT_CATEGORIES } from "./categories";

describe("isDemoEmail", () => {
  it("reconoce un email demo (prefijo + dominio correctos)", () => {
    expect(isDemoEmail(`${DEMO_EMAIL_PREFIX}abc-123@${DEMO_EMAIL_DOMAIN}`)).toBe(true);
  });

  it("rechaza un email real", () => {
    expect(isDemoEmail("gregorio@gmail.com")).toBe(false);
  });

  it("rechaza prefijo correcto pero dominio real (no lo reaparía el cron)", () => {
    expect(isDemoEmail(`${DEMO_EMAIL_PREFIX}abc@gmail.com`)).toBe(false);
  });

  it("rechaza dominio demo pero sin el prefijo", () => {
    expect(isDemoEmail(`hola@${DEMO_EMAIL_DOMAIN}`)).toBe(false);
  });
});

/**
 * Fake mínimo del cliente Prisma que registra las llamadas. Devuelve ids
 * incrementales donde el código lee el `.id` del row creado (card/purchase).
 */
function makeFakeClient() {
  let seq = 0;
  // El `_a: unknown` hace que `.mock.calls` quede tipado (tupla `[unknown]`), para
  // poder castear el primer argumento en las aserciones.
  const cardCreate = vi.fn(async (_a: unknown) => ({ id: `card-${seq++}` }));
  const purchaseCreate = vi.fn(async (_a: unknown) => ({ id: `purchase-${seq++}` }));
  const categoryUpdate = vi.fn(async (_a: unknown) => ({}));
  const installmentCreateMany = vi.fn(async (_a: unknown) => ({ count: 0 }));
  const installmentUpdateMany = vi.fn(async (_a: unknown) => ({ count: 0 }));
  const incomeCreateMany = vi.fn(async (_a: unknown) => ({ count: 0 }));
  const savingsCreateMany = vi.fn(async (_a: unknown) => ({ count: 0 }));
  const rateCreate = vi.fn(async (_a: unknown) => ({}));

  // Las categorías default con un id ficticio (= nombre): lo que devuelve el hook.
  const categoryFindMany = vi.fn(async (_a: unknown) =>
    DEFAULT_CATEGORIES.map((name) => ({ id: `cat-${name}`, name }))
  );

  const client = {
    card: { create: cardCreate },
    category: { findMany: categoryFindMany, update: categoryUpdate },
    purchase: { create: purchaseCreate },
    installment: { createMany: installmentCreateMany, updateMany: installmentUpdateMany },
    incomeEntry: { createMany: incomeCreateMany },
    savingsBalance: { createMany: savingsCreateMany },
    exchangeRate: { create: rateCreate },
  };

  return {
    client,
    fns: {
      cardCreate,
      purchaseCreate,
      categoryUpdate,
      categoryFindMany,
      installmentCreateMany,
      installmentUpdateMany,
      incomeCreateMany,
      savingsCreateMany,
      rateCreate,
    },
  };
}

/** Extrae el `data` (primer arg) de cada llamada a un vi.fn de Prisma. */
function dataArgs<T = Record<string, unknown>>(fn: ReturnType<typeof vi.fn>): T[] {
  return fn.mock.calls.map((c) => (c[0] as { data: T }).data);
}

describe("seedDemoData", () => {
  it("crea 5 tarjetas: 4 de crédito y 1 de débito", async () => {
    const { client, fns } = makeFakeClient();
    await seedDemoData(client as never, "user-1");

    const cards = dataArgs<{ type: string }>(fns.cardCreate);
    expect(cards).toHaveLength(5);
    expect(cards.filter((c) => c.type === "CREDIT")).toHaveLength(4);
    expect(cards.filter((c) => c.type === "DEBIT")).toHaveLength(1);
  });

  it("todo lo creado lleva el userId de la sesión (aislamiento)", async () => {
    const { client, fns } = makeFakeClient();
    await seedDemoData(client as never, "user-xyz");

    const allData = [
      ...dataArgs<{ userId?: string }>(fns.cardCreate),
      ...dataArgs<{ userId?: string }>(fns.purchaseCreate),
    ];
    expect(allData.every((d) => d.userId === "user-xyz")).toBe(true);
  });

  it("materializa cuotas SOLO para las compras a crédito; los gastos no-crédito no", async () => {
    const { client, fns } = makeFakeClient();
    await seedDemoData(client as never, "user-1");

    const purchases = dataArgs<{ paymentMethod: string; cardId: string | null; totalInstallments: number }>(
      fns.purchaseCreate
    );
    const credit = purchases.filter((p) => p.paymentMethod === "CREDIT");
    const nonCredit = purchases.filter((p) => p.paymentMethod !== "CREDIT");

    expect(credit.length).toBeGreaterThan(0);
    expect(nonCredit.length).toBeGreaterThan(0);

    // Una llamada a installment.createMany por compra a crédito, ninguna para el resto.
    expect(fns.installmentCreateMany).toHaveBeenCalledTimes(credit.length);

    // Los no-crédito son pago único, sin tarjeta.
    expect(nonCredit.every((p) => p.cardId === null)).toBe(true);
    expect(nonCredit.every((p) => p.totalInstallments === 1)).toBe(true);
  });

  it("cada lote de cuotas es de UNA sola moneda y suma exactamente su plan (redondeo)", async () => {
    const { client, fns } = makeFakeClient();
    await seedDemoData(client as never, "user-1");

    // Compras a crédito en orden: se emparejan con los lotes de cuotas (createMany
    // sigue inmediatamente a su purchase.create dentro del loop de crédito).
    const creditPurchases = dataArgs<{ paymentMethod: string; currency: string; totalInstallments: number }>(
      fns.purchaseCreate
    ).filter((p) => p.paymentMethod === "CREDIT");

    const batches = dataArgs<{ amountCents: bigint; currency: string }[]>(fns.installmentCreateMany);
    expect(batches).toHaveLength(creditPurchases.length);

    batches.forEach((rows, i) => {
      const plan = creditPurchases[i];
      // Cantidad de cuotas = plan.
      expect(rows).toHaveLength(plan.totalInstallments);
      // Nunca se mezclan monedas dentro de un lote (RF-9.1).
      expect(rows.every((r) => r.currency === plan.currency)).toBe(true);
      expect(["ARS", "USD"]).toContain(plan.currency);
      // Reparto de centavos: cada cuota es `base` o `base+1` (diferencia máx. 1 centavo).
      const amounts = rows.map((r) => r.amountCents);
      const min = amounts.reduce((a, b) => (b < a ? b : a));
      const max = amounts.reduce((a, b) => (b > a ? b : a));
      expect(max - min).toBeLessThanOrEqual(1n);
    });
  });

  it("pinta de color todas las categorías default (para el donut)", async () => {
    const { client, fns } = makeFakeClient();
    await seedDemoData(client as never, "user-1");

    expect(fns.categoryUpdate).toHaveBeenCalledTimes(DEFAULT_CATEGORIES.length);
    const updates = fns.categoryUpdate.mock.calls.map((c) => c[0] as { data: { color: string } });
    expect(updates.every((u) => /^#[0-9a-f]{6}$/i.test(u.data.color))).toBe(true);
  });

  it("siembra ingreso y ahorro para ARS y USD, más el tipo de cambio USD→ARS", async () => {
    const { client, fns } = makeFakeClient();
    await seedDemoData(client as never, "user-1");

    // createMany recibe `data` como array de filas; hay una sola llamada.
    const income = dataArgs<{ currency: string }[]>(fns.incomeCreateMany)[0];
    const savings = dataArgs<{ currency: string }[]>(fns.savingsCreateMany)[0];
    expect(income.map((r) => r.currency).sort()).toEqual(["ARS", "USD"]);
    expect(savings.map((r) => r.currency).sort()).toEqual(["ARS", "USD"]);

    expect(fns.rateCreate).toHaveBeenCalledOnce();
    const rate = fns.rateCreate.mock.calls[0][0] as { data: { fromCurrency: string; toCurrency: string } };
    expect(rate.data.fromCurrency).toBe("USD");
    expect(rate.data.toCurrency).toBe("ARS");
  });
});
