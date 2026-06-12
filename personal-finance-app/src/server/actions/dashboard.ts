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
    select: { monthlyIncomeCents: true, defaultCurrency: true },
  });
  const defaultCurrency = profile?.defaultCurrency ?? "ARS";
  const incomeCents = profile?.monthlyIncomeCents ?? 0n;

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
    const isDefault = currency === defaultCurrency;
    currencies.push({
      currency,
      committedCents,
      nextDue,
      incomeCents: isDefault ? incomeCents : null,
      netCents: isDefault ? incomeCents - committedCents : null,
    });
  }

  // La moneda principal va primero.
  currencies.sort((a, b) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0
  );

  return { defaultCurrency, hasIncome: incomeCents > 0n, overdueCount, currencies };
}

/**
 * Estado de alta del usuario para el onboarding de la ventana principal: ingreso
 * configurado (RF-5.1), al menos una tarjeta (RF-2) y al menos una compra (RF-3).
 * Scopeado por el `userId` de sesión. La decisión de qué mostrar (checklist vs.
 * dashboard) vive en la función pura `@/server/lib/onboarding`.
 */
export async function getOnboardingStatus(): Promise<OnboardingFlags> {
  const user = await requireUser();

  const [profile, cardCount, purchaseCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { monthlyIncomeCents: true },
    }),
    prisma.card.count({ where: { userId: user.id } }),
    prisma.purchase.count({ where: { userId: user.id } }),
  ]);

  return {
    hasIncome: (profile?.monthlyIncomeCents ?? 0n) > 0n,
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
      cardId: r.purchase.card.id,
      cardName: r.purchase.card.name,
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
