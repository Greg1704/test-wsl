"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import {
  subscriptionSchema,
  chargeActionSchema,
} from "@/lib/validation/subscription";
import { currencyToCents, formatMoney } from "@/server/lib/money";
import {
  formatDate,
  formatMonthYear,
  startOfMonth,
  startOfToday,
} from "@/server/lib/dates";
import { incomeForMonth } from "@/server/lib/savings";
import {
  getSubscriptionChargesForMonth,
  getSubscriptionsSchedule,
} from "@/server/queries/subscriptions";

/** Revalida todas las vistas que dependen de las suscripciones. */
function revalidateSubscriptionViews() {
  revalidatePath("/suscripciones");
  revalidatePath("/dashboard");
  revalidatePath("/tarjetas"); // utilización
  revalidatePath("/calendario");
}

type ParsedSubscription = ReturnType<typeof subscriptionSchema.parse>;

/**
 * Valida pertenencia y coherencia de una suscripción (endpoint público): la tarjeta y la
 * categoría deben ser del usuario; la tarjeta, del tipo correcto y operar la moneda elegida;
 * y con el seguimiento de límite activo + tarjeta con límite + moneda ≠ principal, la
 * cotización (`limitRate`) es requerida — mismo criterio que `createPurchase`.
 */
async function resolveSubscriptionInput(userId: string, data: ParsedSubscription) {
  const isCredit = data.paymentMethod === "CREDIT";

  let card: { id: string; type: string; currencies: string[]; creditLimitCents: bigint | null } | null =
    null;
  if (data.cardId) {
    card = await prisma.card.findFirst({
      where: { id: data.cardId, userId },
      select: { id: true, type: true, currencies: true, creditLimitCents: true },
    });
    if (!card) throw new Error("Tarjeta no encontrada");
    const expectedType = isCredit ? "CREDIT" : "DEBIT";
    if (card.type !== expectedType) {
      throw new Error("Tipo de tarjeta inválido para el medio de pago");
    }
    if (!card.currencies.includes(data.currency)) {
      throw new Error("La tarjeta no opera en esa moneda");
    }
  }
  if (isCredit && !card) throw new Error("Elegí una tarjeta de crédito");

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId },
      select: { id: true },
    });
    if (!category) throw new Error("Categoría no encontrada");
  }

  let limitRate: number | null = null;
  if (isCredit && card) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultCurrency: true, trackCreditLimits: true },
    });
    const needsConversion =
      !!profile?.trackCreditLimits &&
      card.creditLimitCents != null &&
      data.currency !== profile.defaultCurrency;
    if (needsConversion && data.limitRate == null) {
      throw new Error("Falta la cotización para imputar la suscripción al límite de crédito");
    }
    limitRate = needsConversion ? data.limitRate ?? null : null;
  }

  return { cardId: card?.id ?? null, categoryId: data.categoryId ?? null, limitRate };
}

/** Datos comunes de Prisma para crear/actualizar (el `userId` nunca viene del cliente). */
function toSubscriptionData(
  data: ParsedSubscription,
  resolved: Awaited<ReturnType<typeof resolveSubscriptionInput>>
) {
  return {
    name: data.name,
    amountCents: currencyToCents(data.amount),
    currency: data.currency,
    paymentMethod: data.paymentMethod,
    cardId: resolved.cardId,
    firstChargeDate: data.firstChargeDate,
    endDate: data.endDate ?? null,
    categoryId: resolved.categoryId,
    limitRate: resolved.limitRate,
  };
}

export async function createSubscription(input: unknown) {
  const user = await requireUser();
  const data = subscriptionSchema.parse(input);
  const resolved = await resolveSubscriptionInput(user.id, data);

  await prisma.subscription.create({
    data: { ...toSubscriptionData(data, resolved), userId: user.id },
  });
  revalidateSubscriptionViews();
}

export async function updateSubscription(id: string, input: unknown) {
  const user = await requireUser();
  const data = subscriptionSchema.parse(input);

  const existing = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    select: { id: true, amountCents: true },
  });
  if (!existing) throw new Error("Suscripción no encontrada");

  const resolved = await resolveSubscriptionInput(user.id, data);
  const newData = toSubscriptionData(data, resolved);

  await prisma.$transaction(async (tx) => {
    // Si cambia el monto, congelamos los cobros ya marcados (pagados/salteados) al monto
    // VIEJO para no reescribir el historial. Solo los que aún no tienen override de monto
    // (los ya marcados fueron snapshotteados al marcarse). Los PENDIENTES no tienen fila,
    // así que toman el monto nuevo automáticamente.
    if (newData.amountCents !== existing.amountCents) {
      await tx.subscriptionCharge.updateMany({
        where: { subscriptionId: id, amountCentsOverride: null },
        data: { amountCentsOverride: existing.amountCents },
      });
    }
    // updateMany filtra por userId: el usuario A no puede editar la suscripción de B.
    await tx.subscription.updateMany({
      where: { id, userId: user.id },
      data: newData,
    });
  });
  revalidateSubscriptionViews();
}

export async function deleteSubscription(id: string) {
  const user = await requireUser();

  const existing = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Suscripción no encontrada");

  // Guard duro: no se puede borrar una suscripción con cobros PAGADOS. El borrado es un hard
  // delete (los overrides caen por onDelete: Cascade), así que arrastraría esos pagos y
  // reescribiría el historial de ahorro de meses pasados (el saldo se computa al leer). Para
  // dejar de cobrarla conservando el historial hay que darla de baja (endDate). Mismo criterio
  // que deactivateCard con cuotas pendientes.
  const paidCount = await prisma.subscriptionCharge.count({
    where: { subscriptionId: id, status: "PAID" },
  });
  if (paidCount > 0) {
    throw new Error(
      `No podés eliminar una suscripción con ${paidCount} cobro(s) ya pagado(s): borraría el historial. Archivala para sacarla de la lista sin perder los pagos.`
    );
  }

  // Sin cobros pagados: borrado real (los overrides salteados caen por cascade).
  await prisma.subscription.deleteMany({ where: { id, userId: user.id } });
  revalidateSubscriptionViews();
}

/**
 * Archiva (desactiva) una suscripción: sale de la lista activa y deja de generar cobros
 * nuevos, pero sus cobros PAGADOS siguen contando en el historial de ahorro. Es la vía para
 * "cerrar" una suscripción con pagos (que no se puede borrar). Reversible con reactivate.
 */
export async function archiveSubscription(id: string) {
  const user = await requireUser();
  const { count } = await prisma.subscription.updateMany({
    where: { id, userId: user.id },
    data: { isActive: false },
  });
  if (count === 0) throw new Error("Suscripción no encontrada");
  revalidateSubscriptionViews();
}

/**
 * Reactiva una suscripción archivada: vuelve a la lista activa y retoma los cobros desde el
 * mes actual. Limpia la baja programada (endDate) si la tenía. Los meses en que estuvo
 * archivada no se rellenan hacia atrás: el saldo real histórico usa los cobros ya pagados.
 */
export async function reactivateSubscription(id: string) {
  const user = await requireUser();
  const { count } = await prisma.subscription.updateMany({
    where: { id, userId: user.id },
    data: { isActive: true, endDate: null },
  });
  if (count === 0) throw new Error("Suscripción no encontrada");
  revalidateSubscriptionViews();
}

/**
 * Marca el cobro de un mes de una suscripción: PAID, SKIPPED o RESET (borra el override →
 * vuelve a PENDING). Upsert sobre la clave única (subscriptionId, periodMonth). Scopeado
 * por `userId` vía la pertenencia de la suscripción.
 */
export async function setChargeState(input: unknown) {
  const user = await requireUser();
  const data = chargeActionSchema.parse(input);

  const sub = await prisma.subscription.findFirst({
    where: { id: data.subscriptionId, userId: user.id },
    select: { id: true, amountCents: true },
  });
  if (!sub) throw new Error("Suscripción no encontrada");
  const periodMonth = startOfMonth(data.periodMonth);
  const key = { subscriptionId_periodMonth: { subscriptionId: sub.id, periodMonth } };

  if (data.action === "RESET") {
    await prisma.subscriptionCharge.deleteMany({
      where: { subscriptionId: sub.id, periodMonth },
    });
  } else if (data.action === "PAID") {
    const paidFromSavings = data.paidFromSavings ?? true;
    // Snapshot del monto al marcar: si después cambia el precio de la suscripción, este cobro
    // conserva lo que efectivamente se pagó (no se reescribe el historial).
    await prisma.subscriptionCharge.upsert({
      where: key,
      create: {
        subscriptionId: sub.id,
        periodMonth,
        status: "PAID",
        paidFromSavings,
        paidAt: new Date(),
        amountCentsOverride: sub.amountCents,
      },
      update: {
        status: "PAID",
        paidFromSavings,
        paidAt: new Date(),
        amountCentsOverride: sub.amountCents,
      },
    });
  } else {
    // SKIPPED: este mes no cuenta (baja temporal / no se cobró). Igual congelamos el monto,
    // así un cambio de precio no altera lo que muestra este mes.
    await prisma.subscriptionCharge.upsert({
      where: key,
      create: {
        subscriptionId: sub.id,
        periodMonth,
        status: "SKIPPED",
        paidFromSavings: false,
        paidAt: null,
        amountCentsOverride: sub.amountCents,
      },
      update: {
        status: "SKIPPED",
        paidFromSavings: false,
        paidAt: null,
        amountCentsOverride: sub.amountCents,
      },
    });
  }
  revalidateSubscriptionViews();
}

/** Suscripciones de una moneda para un mes: total, ingreso y lista (mayor a menor costo). */
export type SubscriptionCurrencyOverview = {
  currency: string;
  incomeCents: bigint | null;
  totalCents: bigint;
  items: {
    subscriptionId: string;
    name: string;
    amountCents: bigint;
    status: "PENDING" | "PAID";
    cardName: string | null;
  }[];
};

/**
 * Subsección "Suscripciones" del dashboard: los cobros del mes por moneda (nunca sumadas
 * entre sí), con su total y el ingreso vigente para calcular el % del sueldo. Ordenadas de
 * mayor a menor costo. Devuelve `bigint` (se formatea en el server). Scopeada por `userId`.
 */
export async function getSubscriptionsOverview(month: Date): Promise<{
  defaultCurrency: string;
  currencies: SubscriptionCurrencyOverview[];
}> {
  const user = await requireUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultCurrency: true },
  });
  const defaultCurrency = profile?.defaultCurrency ?? "ARS";

  const [charges, incomeRows] = await Promise.all([
    getSubscriptionChargesForMonth(user.id, month),
    prisma.incomeEntry.findMany({
      where: { userId: user.id },
      select: { currency: true, amountCents: true, validFrom: true },
    }),
  ]);

  const incomeByCurrency = new Map<string, { amountCents: bigint; validFrom: Date }[]>();
  for (const e of incomeRows) {
    const list = incomeByCurrency.get(e.currency) ?? [];
    list.push({ amountCents: e.amountCents, validFrom: e.validFrom });
    incomeByCurrency.set(e.currency, list);
  }

  const byCurrency = new Map<string, SubscriptionCurrencyOverview>();
  for (const c of charges) {
    const entry =
      byCurrency.get(c.currency) ??
      ({ currency: c.currency, incomeCents: null, totalCents: 0n, items: [] } as SubscriptionCurrencyOverview);
    entry.items.push({
      subscriptionId: c.subscriptionId,
      name: c.name,
      amountCents: c.amountCents,
      status: c.status,
      cardName: c.cardName,
    });
    entry.totalCents += c.amountCents;
    byCurrency.set(c.currency, entry);
  }

  for (const [currency, entry] of byCurrency) {
    const income = incomeForMonth(incomeByCurrency.get(currency) ?? [], month);
    entry.incomeCents = income > 0n ? income : null;
    // Mayor a menor costo.
    entry.items.sort((a, b) =>
      b.amountCents > a.amountCents ? 1 : b.amountCents < a.amountCents ? -1 : 0
    );
  }

  const currencies = Array.from(byCurrency.values()).sort((a, b) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0
  );
  return { defaultCurrency, currencies };
}

/** Cobro de un mes en la vista de gestión (DTO plano, serializable al cliente). */
export type ScheduledChargeView = {
  periodMonth: string; // ISO date (primer día del mes), para reenviar a setChargeState
  periodLabel: string;
  dueDate: string;
  amount: string;
  status: "PENDING" | "PAID" | "SKIPPED";
  paidFromSavings: boolean;
};

/** Suscripción para la página de gestión: display + campos crudos para el form de edición. */
export type SubscriptionView = {
  id: string;
  name: string;
  currency: string;
  paymentMethod: "CREDIT" | "DEBIT";
  cardName: string | null;
  categoryName: string | null;
  amount: string; // mensual, formateado
  amountValue: number; // para prefilear el form
  firstChargeDate: string; // ISO
  firstChargeLabel: string;
  endDate: string | null; // ISO
  endLabel: string | null;
  active: boolean;
  /** Tiene cobros pagados: bloquea el borrado (guard duro; usar baja). */
  hasPaidCharges: boolean;
  cardId: string | null;
  categoryId: string | null;
  limitRateValue: number | null;
  upcoming: ScheduledChargeView[];
};

/**
 * Datos de la página `/suscripciones`: cada suscripción con sus próximos cobros y los campos
 * necesarios para editarla. DTOs planos (sin BigInt/Decimal/Date) — cruzan el borde RSC hacia
 * los dialogs y toggles (regla `.claude/rules/rsc-y-payload.md`). Scopeado por `userId`.
 */
export async function getSubscriptionsPageData(): Promise<SubscriptionView[]> {
  const user = await requireUser();
  const schedule = await getSubscriptionsSchedule(user.id, 6);
  const currentMonthIdx = startOfMonth(startOfToday()).getTime();

  return schedule.map(({ row, upcoming, hasPaidCharges }) => {
    // Activa = no archivada Y sin baja programada ya vencida.
    const active =
      row.isActive &&
      (row.endDate == null || startOfMonth(row.endDate).getTime() >= currentMonthIdx);
    return {
      hasPaidCharges,
      id: row.id,
      name: row.name,
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      cardName: row.card?.name ?? null,
      categoryName: row.category?.name ?? null,
      amount: formatMoney(row.amountCents, row.currency),
      amountValue: Number(row.amountCents) / 100,
      firstChargeDate: row.firstChargeDate.toISOString(),
      firstChargeLabel: formatDate(row.firstChargeDate),
      endDate: row.endDate ? row.endDate.toISOString() : null,
      endLabel: row.endDate ? formatDate(row.endDate) : null,
      active,
      cardId: row.cardId,
      categoryId: row.categoryId,
      limitRateValue: row.limitRate ? Number(row.limitRate) : null,
      upcoming: upcoming.map((u) => ({
        periodMonth: u.periodMonth.toISOString(),
        periodLabel: formatMonthYear(u.periodMonth),
        dueDate: formatDate(u.dueDate),
        amount: formatMoney(u.amountCents, row.currency),
        status: u.status,
        paidFromSavings: u.paidFromSavings,
      })),
    };
  });
}
