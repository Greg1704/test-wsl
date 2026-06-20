"use server";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { addMonths, monthRange, startOfMonth, startOfToday } from "@/server/lib/dates";
import {
  buildCategoryBreakdown,
  buildProjection,
  type CategoryBreakdown,
  type ProjectionSeries,
} from "@/server/lib/dashboard";
import {
  incomeForMonth,
  computeSavings,
  buildSavingsProjection,
  type IncomeEntryInput,
} from "@/server/lib/savings";
import type { OnboardingFlags } from "@/server/lib/onboarding";

/** Resumen de una moneda para el mes (RF-5.1). `income`/`net` solo en la principal. */
export type CurrencyOverview = {
  currency: string;
  committedCents: bigint;
  nextDue: { dueDate: Date; amountCents: bigint } | null;
  incomeCents: bigint | null;
  netCents: bigint | null;
};

export type MonthlyOverview = {
  defaultCurrency: string;
  hasIncome: boolean;
  overdueCount: number;
  currencies: CurrencyOverview[];
};

/**
 * Resumen del dashboard para un mes (RF-5). Por cada moneda: total comprometido
 * (todas las cuotas que vencen ese mes), próximo vencimiento y —solo en la moneda
 * principal— ingreso y disponible neto. Más el conteo global de cuotas vencidas.
 * Todo scopeado por el `userId` de sesión. Llamado desde un Server Component, así
 * que devuelve `bigint` (se formatea en el server, sin cruzar el borde a Client).
 */
export async function getMonthlyOverview(month: Date): Promise<MonthlyOverview> {
  const user = await requireUser();
  const { gte, lt } = monthRange(month);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultCurrency: true },
  });
  const defaultCurrency = profile?.defaultCurrency ?? "ARS";

  // Ingreso fechado por moneda (modelo IncomeEntry): el del mes navegado es la entrada
  // vigente (mayor validFrom <= mes). Agrupamos por moneda en memoria.
  const incomeRows = await prisma.incomeEntry.findMany({
    where: { userId: user.id },
    select: { currency: true, amountCents: true, validFrom: true },
  });
  const incomeByCurrency = new Map<string, IncomeEntryInput[]>();
  for (const r of incomeRows) {
    const list = incomeByCurrency.get(r.currency) ?? [];
    list.push({ amountCents: r.amountCents, validFrom: r.validFrom });
    incomeByCurrency.set(r.currency, list);
  }
  const incomeForCurrency = (currency: string): bigint | null => {
    const entries = incomeByCurrency.get(currency);
    return entries ? incomeForMonth(entries, month) : null;
  };

  // Total comprometido por moneda (cuotas que vencen en el mes, pagas o no).
  const grouped = await prisma.installment.groupBy({
    by: ["currency"],
    where: { dueDate: { gte, lt }, purchase: { userId: user.id } },
    _sum: { amountCents: true },
  });
  const committedByCurrency = new Map<string, bigint>();
  for (const g of grouped) {
    committedByCurrency.set(g.currency, g._sum.amountCents ?? 0n);
  }

  // Cuotas vencidas: impagas con vencimiento anterior a hoy (badge de alerta, RF-5.2).
  const overdueCount = await prisma.installment.count({
    where: {
      status: "PENDING",
      dueDate: { lt: startOfToday() },
      purchase: { userId: user.id },
    },
  });

  // Monedas a mostrar: la principal siempre, más cualquiera con cuotas en el mes.
  const currencySet = new Set<string>([defaultCurrency, ...committedByCurrency.keys()]);

  const currencies: CurrencyOverview[] = [];
  for (const currency of currencySet) {
    const committedCents = committedByCurrency.get(currency) ?? 0n;
    const nextDue = await prisma.installment.findFirst({
      where: {
        currency,
        status: "PENDING",
        dueDate: { gte: startOfToday() },
        purchase: { userId: user.id },
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true, amountCents: true },
    });
    const income = incomeForCurrency(currency);
    currencies.push({
      currency,
      committedCents,
      nextDue,
      incomeCents: income,
      netCents: income !== null ? income - committedCents : null,
    });
  }

  // La moneda principal va primero.
  currencies.sort((a, b) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0
  );

  const defaultIncome = incomeForCurrency(defaultCurrency) ?? 0n;
  return { defaultCurrency, hasIncome: defaultIncome > 0n, overdueCount, currencies };
}

/** Ahorro de una moneda para el mes: disponible, proyección tras cuotas y saldo real. */
export type SavingsCurrencyOverview = {
  currency: string;
  beforeCents: bigint;
  afterCents: bigint;
  currentRealCents: bigint;
};

export type SavingsOverview = {
  defaultCurrency: string;
  /** Solo monedas con algún dato de ahorro (ancla, ingreso o gasto no-crédito). */
  currencies: SavingsCurrencyOverview[];
};

/**
 * Ahorro por moneda para el mes navegado (RF-ahorros). Junta el ancla declarada
 * (`SavingsBalance`), el ingreso fechado (`IncomeEntry`), los gastos no-crédito
 * (débito/transferencia/efectivo) y las cuotas pagadas-desde-ahorros, y delega el
 * cálculo en la función pura `computeSavings`. Todo scopeado por el `userId` de sesión.
 */
export async function getSavingsOverview(month: Date): Promise<SavingsOverview> {
  const user = await requireUser();
  const { gte, lt } = monthRange(month);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultCurrency: true },
  });
  const defaultCurrency = profile?.defaultCurrency ?? "ARS";

  const [anchors, incomeRows, nonCredit, savingsCuotas, committedGrouped] =
    await Promise.all([
      prisma.savingsBalance.findMany({
        where: { userId: user.id },
        select: { currency: true, amountCents: true, asOf: true },
      }),
      prisma.incomeEntry.findMany({
        where: { userId: user.id },
        select: { currency: true, amountCents: true, validFrom: true },
      }),
      // Gastos no-crédito: pago único que descuenta del ahorro (no tienen cuotas).
      prisma.purchase.findMany({
        where: { userId: user.id, paymentMethod: { in: ["DEBIT", "TRANSFER", "CASH"] } },
        select: { currency: true, purchaseDate: true, totalAmountCents: true },
      }),
      // Cuotas de crédito que el usuario marcó pagadas-desde-ahorros.
      prisma.installment.findMany({
        where: { purchase: { userId: user.id }, paidFromSavings: true, status: "PAID" },
        select: { currency: true, paidAt: true, amountCents: true },
      }),
      // Cuotas que vencen en el mes, por moneda (para la proyección "tras cuotas").
      prisma.installment.groupBy({
        by: ["currency"],
        where: { dueDate: { gte, lt }, purchase: { userId: user.id } },
        _sum: { amountCents: true },
      }),
    ]);

  // Agrupados por moneda en memoria.
  const byCurrency = <T extends { currency: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const list = map.get(r.currency) ?? [];
      list.push(r);
      map.set(r.currency, list);
    }
    return map;
  };
  const anchorByCurrency = new Map(anchors.map((a) => [a.currency, a]));
  const incomeByCurrency = byCurrency(incomeRows);
  const expenseByCurrency = byCurrency(nonCredit);
  const cuotaByCurrency = byCurrency(savingsCuotas.filter((c) => c.paidAt));
  const committedByCurrency = new Map(
    committedGrouped.map((g) => [g.currency, g._sum.amountCents ?? 0n])
  );

  // Monedas a mostrar: la principal + cualquiera con ancla, ingreso o gasto no-crédito.
  const currencySet = new Set<string>([
    defaultCurrency,
    ...anchorByCurrency.keys(),
    ...incomeByCurrency.keys(),
    ...expenseByCurrency.keys(),
  ]);

  const currencies: SavingsCurrencyOverview[] = [];
  for (const currency of currencySet) {
    const anchor = anchorByCurrency.get(currency);
    const result = computeSavings({
      anchor: anchor ? { amountCents: anchor.amountCents, asOf: anchor.asOf } : null,
      incomeEntries: (incomeByCurrency.get(currency) ?? []).map((e) => ({
        amountCents: e.amountCents,
        validFrom: e.validFrom,
      })),
      nonCreditExpenses: (expenseByCurrency.get(currency) ?? []).map((e) => ({
        purchaseDate: e.purchaseDate,
        amountCents: e.totalAmountCents,
      })),
      savingsCuotas: (cuotaByCurrency.get(currency) ?? []).map((c) => ({
        paidAt: c.paidAt!,
        amountCents: c.amountCents,
      })),
      month,
      committedThisMonthCents: committedByCurrency.get(currency) ?? 0n,
    });
    currencies.push({ currency, ...result });
  }

  currencies.sort((a, b) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0
  );

  return { defaultCurrency, currencies };
}

export type SavingsProjectionSeries = {
  currency: string;
  months: { month: Date; beforeCents: bigint }[];
};

/**
 * Serie del ahorro disponible proyectado `months` meses desde `fromMonth`, por moneda
 * (RF-ahorros). Junta los mismos insumos que `getSavingsOverview` (ancla, ingreso, gastos
 * no-crédito, cuotas-desde-ahorros) y delega en la función pura `buildSavingsProjection`.
 * Scopeada por el `userId` de sesión.
 */
export async function getSavingsProjection(
  fromMonth: Date,
  months: number = 12
): Promise<SavingsProjectionSeries[]> {
  const user = await requireUser();

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultCurrency: true },
  });
  const defaultCurrency = profile?.defaultCurrency ?? "ARS";

  const [anchors, incomeRows, nonCredit, savingsCuotas] = await Promise.all([
    prisma.savingsBalance.findMany({
      where: { userId: user.id },
      select: { currency: true, amountCents: true, asOf: true },
    }),
    prisma.incomeEntry.findMany({
      where: { userId: user.id },
      select: { currency: true, amountCents: true, validFrom: true },
    }),
    prisma.purchase.findMany({
      where: { userId: user.id, paymentMethod: { in: ["DEBIT", "TRANSFER", "CASH"] } },
      select: { currency: true, purchaseDate: true, totalAmountCents: true },
    }),
    prisma.installment.findMany({
      where: { purchase: { userId: user.id }, paidFromSavings: true, status: "PAID" },
      select: { currency: true, paidAt: true, amountCents: true },
    }),
  ]);

  const byCurrency = <T extends { currency: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const list = map.get(r.currency) ?? [];
      list.push(r);
      map.set(r.currency, list);
    }
    return map;
  };
  const anchorByCurrency = new Map(anchors.map((a) => [a.currency, a]));
  const incomeByCurrency = byCurrency(incomeRows);
  const expenseByCurrency = byCurrency(nonCredit);
  const cuotaByCurrency = byCurrency(savingsCuotas.filter((c) => c.paidAt));

  const currencySet = new Set<string>([
    defaultCurrency,
    ...anchorByCurrency.keys(),
    ...incomeByCurrency.keys(),
    ...expenseByCurrency.keys(),
  ]);

  const series: SavingsProjectionSeries[] = [];
  for (const currency of currencySet) {
    const anchor = anchorByCurrency.get(currency);
    const months_ = buildSavingsProjection(
      {
        anchor: anchor ? { amountCents: anchor.amountCents, asOf: anchor.asOf } : null,
        incomeEntries: (incomeByCurrency.get(currency) ?? []).map((e) => ({
          amountCents: e.amountCents,
          validFrom: e.validFrom,
        })),
        nonCreditExpenses: (expenseByCurrency.get(currency) ?? []).map((e) => ({
          purchaseDate: e.purchaseDate,
          amountCents: e.totalAmountCents,
        })),
        savingsCuotas: (cuotaByCurrency.get(currency) ?? []).map((c) => ({
          paidAt: c.paidAt!,
          amountCents: c.amountCents,
        })),
      },
      fromMonth,
      months
    );
    series.push({ currency, months: months_ });
  }

  series.sort((a, b) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0
  );
  return series;
}

/**
 * Desglose por categoría del GASTO NO-CRÉDITO del mes (débito/transferencia/efectivo),
 * por moneda. Reusa la función pura `buildCategoryBreakdown` con las compras no-crédito
 * (que no tienen cuotas). Scopeado por el `userId` de sesión.
 */
export async function getNonCreditBreakdown(month: Date): Promise<CategoryBreakdown[]> {
  const user = await requireUser();
  const { gte, lt } = monthRange(month);

  const rows = await prisma.purchase.findMany({
    where: {
      userId: user.id,
      paymentMethod: { in: ["DEBIT", "TRANSFER", "CASH"] },
      purchaseDate: { gte, lt },
    },
    select: {
      totalAmountCents: true,
      currency: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });

  return buildCategoryBreakdown(
    rows.map((r) => ({
      amountCents: r.totalAmountCents,
      currency: r.currency,
      category: r.category,
    }))
  );
}

/**
 * Estado de alta del usuario para el onboarding de la ventana principal: ingreso
 * configurado (RF-5.1), al menos una tarjeta (RF-2) y al menos una compra (RF-3).
 * Scopeado por el `userId` de sesión. La decisión de qué mostrar (checklist vs.
 * dashboard) vive en la función pura `@/server/lib/onboarding`.
 */
export async function getOnboardingStatus(): Promise<OnboardingFlags> {
  const user = await requireUser();

  const [incomeCount, cardCount, purchaseCount] = await Promise.all([
    prisma.incomeEntry.count({ where: { userId: user.id } }),
    prisma.card.count({ where: { userId: user.id } }),
    prisma.purchase.count({ where: { userId: user.id } }),
  ]);

  return {
    hasIncome: incomeCount > 0,
    hasCards: cardCount > 0,
    hasPurchases: purchaseCount > 0,
  };
}

/**
 * Serie para el gráfico de proyección: cuotas comprometidas de los próximos
 * `months` meses desde `fromMonth`, por moneda y desglosadas por tarjeta (la
 * vista consolidada multi-tarjeta del producto). El armado de la serie es una
 * función pura testeada (`buildProjection`); acá solo va la query, scopeada
 * por el `userId` de sesión.
 */
export async function getProjection(
  fromMonth: Date,
  months: number = 12
): Promise<ProjectionSeries[]> {
  const user = await requireUser();
  const start = startOfMonth(fromMonth);
  const end = startOfMonth(addMonths(fromMonth, months));

  const rows = await prisma.installment.findMany({
    where: { dueDate: { gte: start, lt: end }, purchase: { userId: user.id } },
    select: {
      dueDate: true,
      amountCents: true,
      currency: true,
      purchase: { select: { card: { select: { id: true, name: true } } } },
    },
  });

  return buildProjection(
    rows.map((r) => ({
      dueDate: r.dueDate,
      amountCents: r.amountCents,
      currency: r.currency,
      // Las cuotas solo existen para crédito ⇒ siempre hay tarjeta.
      cardId: r.purchase.card!.id,
      cardName: r.purchase.card!.name,
    })),
    fromMonth,
    months
  );
}

/**
 * Desglose por categoría de las cuotas que vencen en el mes (RF-7.3, adelantado
 * a Fase 3), por moneda. El agrupado es puro y testeado (`buildCategoryBreakdown`).
 */
export async function getCategoryBreakdown(month: Date): Promise<CategoryBreakdown[]> {
  const user = await requireUser();
  const { gte, lt } = monthRange(month);

  const rows = await prisma.installment.findMany({
    where: { dueDate: { gte, lt }, purchase: { userId: user.id } },
    select: {
      amountCents: true,
      currency: true,
      purchase: {
        select: {
          category: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  return buildCategoryBreakdown(
    rows.map((r) => ({
      amountCents: r.amountCents,
      currency: r.currency,
      category: r.purchase.category,
    }))
  );
}

/** Deuda pendiente total de una moneda: monto, cantidad de cuotas y última fecha. */
export type DebtStat = {
  currency: string;
  remainingCents: bigint;
  pendingCount: number;
  lastDueDate: Date | null;
};

/**
 * Resumen de la deuda restante por moneda: todas las cuotas PENDING (incluidas
 * las vencidas), cuántas son y cuándo vence la última. Alimenta los KPI "deuda
 * restante" y "última cuota" del dashboard.
 */
export async function getDebtStats(): Promise<DebtStat[]> {
  const user = await requireUser();

  const grouped = await prisma.installment.groupBy({
    by: ["currency"],
    where: { status: "PENDING", purchase: { userId: user.id } },
    _sum: { amountCents: true },
    _count: { _all: true },
    _max: { dueDate: true },
  });

  return grouped.map((g) => ({
    currency: g.currency,
    remainingCents: g._sum.amountCents ?? 0n,
    pendingCount: g._count._all,
    lastDueDate: g._max.dueDate,
  }));
}

/**
 * Cuotas que vencen en un mes (agenda del calendario, RF-6). Scopeado por `userId`,
 * con el rango TZ-safe. Trae lo mínimo para mostrar cada cuota (monto, tarjeta,
 * compra de origen, número de cuota). Ordenado por fecha de vencimiento.
 */
export async function listInstallmentsByMonth(month: Date) {
  const user = await requireUser();
  const { gte, lt } = monthRange(month);

  return prisma.installment.findMany({
    where: { dueDate: { gte, lt }, purchase: { userId: user.id } },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      amountCents: true,
      currency: true,
      status: true,
      dueDate: true,
      installmentNumber: true,
      purchase: {
        select: {
          id: true,
          description: true,
          totalInstallments: true,
          card: { select: { name: true, last4: true } },
        },
      },
    },
  });
}
