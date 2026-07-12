/**
 * Lecturas y agregaciones de suscripciones, compartidas por varios consumidores (ahorro,
 * utilización, dashboard, calendario). Funciones planas que reciben `userId` (NO son Server
 * Actions: viven acá, no en `actions/`, para no exponer `userId` como endpoint — mismo patrón
 * que `queries/monthly-overview.ts`). Toda la expansión de cobros delega en la función pura
 * `expandSubscriptions`; acá solo se hacen las queries y se arma el input plano.
 */

import { prisma } from "@/server/db";
import { addMonths, monthRange, startOfMonth, startOfToday } from "@/server/lib/dates";
import { convertCents } from "@/server/lib/card-utilization";
import {
  expandSubscriptions,
  type ChargeOverride,
  type SubscriptionDef,
} from "@/server/lib/subscriptions";

/** Fila de suscripción con lo necesario para expandir y mostrar. */
const defSelect = {
  id: true,
  name: true,
  amountCents: true,
  currency: true,
  paymentMethod: true,
  cardId: true,
  firstChargeDate: true,
  endDate: true,
  isActive: true,
  limitRate: true,
  categoryId: true,
  card: { select: { name: true, currencies: true } },
  category: { select: { name: true } },
} as const;

type DefRow = Awaited<ReturnType<typeof loadDefRows>>[number];

function loadDefRows(userId: string, extraWhere: object = {}) {
  return prisma.subscription.findMany({
    where: { userId, ...extraWhere },
    select: defSelect,
    orderBy: { createdAt: "desc" },
  });
}

/** Fila Prisma → definición plana (Decimal `limitRate` → string; el resto pasa igual). */
function toDef(row: DefRow): SubscriptionDef {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amountCents,
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    cardId: row.cardId,
    firstChargeDate: row.firstChargeDate,
    endDate: row.endDate,
    limitRate: row.limitRate ? row.limitRate.toString() : null,
  };
}

/** Overrides (SubscriptionCharge) del usuario en un rango [gte, lt) de `periodMonth`. */
async function loadOverrides(
  userId: string,
  gte: Date,
  lt: Date
): Promise<ChargeOverride[]> {
  return prisma.subscriptionCharge.findMany({
    where: { subscription: { userId }, periodMonth: { gte, lt } },
    select: {
      subscriptionId: true,
      periodMonth: true,
      status: true,
      paidFromSavings: true,
      amountCentsOverride: true,
    },
  });
}

/**
 * Total de cobros de suscripción PENDIENTES (sin pagar ni saltear) de un mes, por moneda. Alimenta
 * `pendingThisMonthCents` del motor de ahorro: es lo único que el "tras cuotas" resta sobre el
 * saldo real. Lo ya pagado no entra (pagado-desde-ahorros ya bajó el saldo real; pagado sin ahorros
 * no sale del ahorro), así se evita el doble conteo de los cobros previos al ancla.
 */
export async function getSubscriptionPendingForMonth(
  userId: string,
  month: Date
): Promise<Map<string, bigint>> {
  const m = startOfMonth(month);
  const { gte, lt } = monthRange(m);
  const [defRows, overrides] = await Promise.all([
    loadDefRows(userId, { isActive: true }),
    loadOverrides(userId, gte, lt),
  ]);
  const occ = expandSubscriptions(defRows.map(toDef), overrides, m, m);
  const map = new Map<string, bigint>();
  for (const o of occ) {
    if (o.status !== "PENDING") continue; // pagado ya se contabilizó; salteado no cuenta
    map.set(o.currency, (map.get(o.currency) ?? 0n) + o.amountCents);
  }
  return map;
}

/**
 * Cobros de suscripción PAGADOS-desde-ahorros (por moneda y fecha de pago). Se une a
 * `savingsCuotas` del motor de ahorro: reducen el saldo real del mes en que se pagaron y el
 * ahorro disponible de los meses posteriores — exactamente como una cuota pagada.
 */
export async function getSubscriptionSavingsCuotas(
  userId: string
): Promise<{ currency: string; paidAt: Date; amountCents: bigint }[]> {
  const rows = await prisma.subscriptionCharge.findMany({
    where: { status: "PAID", paidFromSavings: true, subscription: { userId } },
    select: {
      periodMonth: true,
      paidAt: true,
      amountCentsOverride: true,
      subscription: { select: { currency: true, amountCents: true } },
    },
  });
  return rows.map((r) => ({
    currency: r.subscription.currency,
    // paidAt real si está; si no, el mes del cobro (para bucketear por mes).
    paidAt: r.paidAt ?? r.periodMonth,
    amountCents: r.amountCentsOverride ?? r.subscription.amountCents,
  }));
}

/**
 * Uso de límite aportado por suscripciones de crédito, por tarjeta, en la moneda principal.
 * Acotado al COBRO DEL MES CORRIENTE no pagado (una suscripción NO compromete su límite a
 * futuro como una compra en N cuotas: cada mes postea su propio cargo). Convierte con
 * `limitRate` snapshot si la suscripción está en otra moneda; excluye las que no la tienen.
 */
export async function getSubscriptionUtilizationByCard(
  userId: string,
  mainCurrency: string,
  cardIds: string[]
): Promise<Map<string, bigint>> {
  const map = new Map<string, bigint>();
  if (cardIds.length === 0) return map;

  const month = startOfMonth(startOfToday());
  const { gte, lt } = monthRange(month);
  const [defRows, overrides] = await Promise.all([
    loadDefRows(userId, { isActive: true, paymentMethod: "CREDIT", cardId: { in: cardIds } }),
    loadOverrides(userId, gte, lt),
  ]);
  const occ = expandSubscriptions(defRows.map(toDef), overrides, month, month);

  for (const o of occ) {
    if (o.status !== "PENDING" || !o.cardId) continue; // pagado libera límite; salteado no cuenta
    let cents: bigint;
    if (o.currency === mainCurrency) {
      cents = o.amountCents;
    } else if (o.limitRate != null) {
      cents = convertCents(o.amountCents, o.limitRate);
    } else {
      continue; // moneda extranjera sin cotización: no imputable al límite
    }
    map.set(o.cardId, (map.get(o.cardId) ?? 0n) + cents);
  }
  return map;
}

/** Cobro de un mes concreto, con nombre y tarjeta, para dashboard y calendario. */
export type MonthlySubscriptionCharge = {
  subscriptionId: string;
  name: string;
  currency: string;
  amountCents: bigint;
  dueDate: Date;
  status: "PENDING" | "PAID";
  paymentMethod: "CREDIT" | "DEBIT";
  cardName: string | null;
};

/**
 * Cobros de suscripción de un mes (excluye los salteados), con nombre y tarjeta. Lo usan la
 * subsección "Suscripciones" del dashboard y el calendario (como preview de flujo).
 */
export async function getSubscriptionChargesForMonth(
  userId: string,
  month: Date
): Promise<MonthlySubscriptionCharge[]> {
  const m = startOfMonth(month);
  const { gte, lt } = monthRange(m);
  const [defRows, overrides] = await Promise.all([
    loadDefRows(userId, { isActive: true }),
    loadOverrides(userId, gte, lt),
  ]);
  const cardNameBySub = new Map(defRows.map((r) => [r.id, r.card?.name ?? null]));
  const occ = expandSubscriptions(defRows.map(toDef), overrides, m, m);

  return occ
    .filter((o) => o.status !== "SKIPPED")
    .map((o) => ({
      subscriptionId: o.subscriptionId,
      name: o.name,
      currency: o.currency,
      amountCents: o.amountCents,
      dueDate: o.dueDate,
      status: o.status as "PENDING" | "PAID",
      paymentMethod: o.paymentMethod,
      cardName: cardNameBySub.get(o.subscriptionId) ?? null,
    }));
}

/** Definición + próximos cobros de una suscripción, para la página de gestión. */
export type SubscriptionWithSchedule = {
  row: DefRow;
  /** Si tiene algún cobro ya pagado (habilita/bloquea el borrado en la UI). */
  hasPaidCharges: boolean;
  upcoming: {
    periodMonth: Date;
    dueDate: Date;
    amountCents: bigint;
    status: "PENDING" | "PAID" | "SKIPPED";
    paidFromSavings: boolean;
  }[];
};

/**
 * Todas las suscripciones del usuario con sus próximos `monthsAhead` cobros (desde el mes
 * corriente), para la página de gestión: permite ver y marcar pago/salteo mes a mes.
 */
export async function getSubscriptionsSchedule(
  userId: string,
  monthsAhead = 6
): Promise<SubscriptionWithSchedule[]> {
  const from = startOfMonth(startOfToday());
  const to = addMonths(from, monthsAhead - 1);
  const [defRows, overrides, paidGroups] = await Promise.all([
    loadDefRows(userId),
    loadOverrides(userId, from, addMonths(to, 1)),
    // Cobros pagados por suscripción (en cualquier mes, no solo la ventana): habilita el guard
    // del borrado. groupBy scopeado por userId vía la relación.
    prisma.subscriptionCharge.groupBy({
      by: ["subscriptionId"],
      where: { status: "PAID", subscription: { userId } },
      _count: { _all: true },
    }),
  ]);
  const paidBySub = new Set(paidGroups.map((g) => g.subscriptionId));
  const occ = expandSubscriptions(defRows.map(toDef), overrides, from, to);

  const bySub = new Map<string, SubscriptionWithSchedule["upcoming"]>();
  for (const o of occ) {
    const list = bySub.get(o.subscriptionId) ?? [];
    list.push({
      periodMonth: o.periodMonth,
      dueDate: o.dueDate,
      amountCents: o.amountCents,
      status: o.status,
      paidFromSavings: o.paidFromSavings,
    });
    bySub.set(o.subscriptionId, list);
  }

  return defRows.map((row) => ({
    row,
    hasPaidCharges: paidBySub.has(row.id),
    upcoming: bySub.get(row.id) ?? [],
  }));
}
