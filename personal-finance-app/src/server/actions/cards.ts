"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { cardSchema, renewCardSchema } from "@/lib/validation/card";
import { parseExpiration, startOfToday } from "@/server/lib/dates";
import { currencyToCents } from "@/server/lib/money";
import { utilizationPercent } from "@/server/lib/card-utilization";
import { toCardView, type CardView } from "@/lib/card-view";

/**
 * Tarjetas vigentes: activas y sin vencer. El DÉBITO no tiene vencimiento, así que
 * siempre cuenta como vigente; el crédito, solo si su `expirationDate` no pasó.
 */
export async function listActiveCards() {
  const user = await requireUser();
  return prisma.card.findMany({
    where: {
      userId: user.id,
      isActive: true,
      OR: [{ type: "DEBIT" }, { expirationDate: { gte: startOfToday() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Tarjetas vencidas: solo crédito (el débito no vence), activas y con fecha pasada. */
export async function listExpiredCards() {
  const user = await requireUser();
  return prisma.card.findMany({
    where: {
      userId: user.id,
      isActive: true,
      type: "CREDIT",
      expirationDate: { lt: startOfToday() },
    },
    orderBy: { expirationDate: "desc" },
  });
}

/** Tarjetas desactivadas a mano (soft delete). */
export async function listDeactivatedCards() {
  const user = await requireUser();
  return prisma.card.findMany({
    where: { userId: user.id, isActive: false },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateCardResult =
  | { status: "created" }
  | { status: "duplicate"; existing: CardView };

/**
 * Mapea los datos validados del form al `data` de Prisma. El DÉBITO no tiene ciclo de
 * facturación, vencimiento ni límite: esos campos se persisten como `null`. El crédito
 * convierte el MM/AA a Date (fin de mes), el límite a centavos, y guarda cierre/vencimiento.
 */
function toCardData(parsed: ReturnType<typeof cardSchema.parse>) {
  const { expiration, closingDay, dueDay, creditLimit, ...rest } = parsed;
  const isCredit = parsed.type === "CREDIT";
  return {
    ...rest,
    closingDay: isCredit ? closingDay : null,
    dueDay: isCredit ? dueDay : null,
    expirationDate: isCredit && expiration ? parseExpiration(expiration) : null,
    creditLimitCents: isCredit && creditLimit != null ? currencyToCents(creditLimit) : null,
  };
}

export async function createCard(input: unknown, force = false): Promise<CreateCardResult> {
  const user = await requireUser();
  const parsed = cardSchema.parse(input);

  if (!force) {
    // Duplicado = mismo banco + últimos 4 (entre activas, vencidas y desactivadas).
    const existing = await prisma.card.findFirst({
      where: { userId: user.id, bank: parsed.bank, last4: parsed.last4 },
    });
    if (existing) {
      return { status: "duplicate", existing: toCardView(existing) };
    }
  }

  await prisma.card.create({
    // El userId SIEMPRE viene de la sesión, nunca del input del cliente.
    data: { ...toCardData(parsed), userId: user.id },
  });

  revalidatePath("/tarjetas");
  return { status: "created" };
}

export type CardUtilizationView = {
  cardId: string;
  name: string;
  /** Moneda del límite/uso (la principal de la tarjeta, `currencies[0]`). */
  currency: string;
  usedCents: string; // BigInt → string (borde serializable)
  limitCents: string;
  percent: number;
};

/**
 * Utilización de las tarjetas de crédito con límite cargado: cuánto del límite está
 * comprometido en cuotas todavía no pagadas, por tarjeta, en su moneda principal.
 * Devuelve un DTO plano (strings/números) reutilizable por la sección de tarjetas
 * (barra inline) y por la alerta del dashboard. Todo scopeado por `userId` de sesión.
 */
export async function getCardsUtilization(): Promise<CardUtilizationView[]> {
  const user = await requireUser();

  const cards = await prisma.card.findMany({
    where: {
      userId: user.id,
      isActive: true,
      type: "CREDIT",
      creditLimitCents: { not: null },
    },
    select: { id: true, name: true, currencies: true, creditLimitCents: true },
  });
  if (cards.length === 0) return [];

  // Uso = suma de cuotas NO pagadas (PENDING/OVERDUE) por tarjeta y moneda. La cuota no
  // guarda `cardId` (va por `purchase`), así que agregamos en JS. Scopeado por userId.
  const rows = await prisma.installment.findMany({
    where: {
      status: { not: "PAID" },
      purchase: { userId: user.id, cardId: { in: cards.map((c) => c.id) } },
    },
    select: { amountCents: true, currency: true, purchase: { select: { cardId: true } } },
  });

  const usedByCard = new Map<string, Map<string, bigint>>();
  for (const r of rows) {
    const cardId = r.purchase.cardId!;
    const byCurrency = usedByCard.get(cardId) ?? new Map<string, bigint>();
    byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0n) + r.amountCents);
    usedByCard.set(cardId, byCurrency);
  }

  return cards.map((c) => {
    const currency = c.currencies[0] ?? "ARS";
    const usedCents = usedByCard.get(c.id)?.get(currency) ?? 0n;
    const limitCents = c.creditLimitCents!;
    return {
      cardId: c.id,
      name: c.name,
      currency,
      usedCents: usedCents.toString(),
      limitCents: limitCents.toString(),
      percent: utilizationPercent(usedCents, limitCents),
    };
  });
}

export async function getCardById(id: string) {
  const user = await requireUser();

  const card = await prisma.card.findFirst({
    where: { id, userId: user.id },
  });

  if (!card) {
    throw new Error("Tarjeta no encontrada");
  }
  return card;
}

export async function updateCard(id: string, input: unknown) {
  const user = await requireUser();
  const parsed = cardSchema.parse(input);

  // La tarjeta debe existir y ser del usuario (findFirst scopeado por userId).
  const existing = await prisma.card.findFirst({ where: { id, userId: user.id } });
  if (!existing) {
    throw new Error("Tarjeta no encontrada");
  }

  // No se puede quitar una moneda que todavía tiene cuotas PENDIENTES en esa moneda:
  // seguiría comprometiendo flujo a futuro (mismo criterio que deactivateCard). Las
  // cuotas guardan su propia `currency`, así que el conteo va por moneda removida.
  const kept = new Set<string>(parsed.currencies);
  const removed = existing.currencies.filter((c) => !kept.has(c));
  if (removed.length > 0) {
    const pending = await prisma.installment.groupBy({
      by: ["currency"],
      where: {
        status: { not: "PAID" },
        currency: { in: removed },
        purchase: { cardId: id, userId: user.id },
      },
      _count: { _all: true },
    });
    if (pending.length > 0) {
      const detail = pending.map((p) => `${p._count._all} cuota(s) en ${p.currency}`).join(", ");
      throw new Error(
        `No podés quitar esa moneda: la tarjeta tiene ${detail} pendiente(s) de pago.`
      );
    }
  }

  // updateMany filtra por userId: el usuario A no puede editar la tarjeta de B.
  const { count } = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: toCardData(parsed),
  });

  if (count === 0) {
    throw new Error("Tarjeta no encontrada");
  }

  revalidatePath("/tarjetas");
}

/**
 * Soft delete: marca la tarjeta como inactiva en vez de borrarla.
 * Preserva el historial de compras/cuotas (el schema tiene onDelete: Cascade,
 * así que un borrado real arrastraría todas las compras de la tarjeta).
 */
export async function deactivateCard(id: string) {
  const user = await requireUser();

  // No se puede desactivar una tarjeta con cuotas sin pagar: seguiría comprometiendo
  // flujo a futuro. El conteo va scopeado por userId (vía la relación purchase).
  const pendingInstallments = await prisma.installment.count({
    where: {
      status: { not: "PAID" },
      purchase: { cardId: id, userId: user.id },
    },
  });
  if (pendingInstallments > 0) {
    throw new Error(
      `No podés desactivar una tarjeta con ${pendingInstallments} cuota(s) pendiente(s) de pago.`
    );
  }

  const { count } = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: { isActive: false },
  });

  if (count === 0) {
    throw new Error("Tarjeta no encontrada");
  }

  revalidatePath("/tarjetas");
}

/**
 * Renueva una tarjeta vencida empujando SOLO su `expirationDate` (la misma cuenta:
 * las cuotas en curso quedan atadas, sin migración). Al quedar la fecha en el
 * futuro, vuelve a aparecer como vigente en `listActiveCards`.
 */
export async function renewCard(id: string, input: unknown) {
  const user = await requireUser();
  const { expiration } = renewCardSchema.parse(input);

  // updateMany filtra por userId: el usuario A no puede renovar la tarjeta de B.
  const { count } = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: { expirationDate: parseExpiration(expiration) },
  });

  if (count === 0) {
    throw new Error("Tarjeta no encontrada");
  }

  revalidatePath("/tarjetas");
}

/** Reactiva una tarjeta desactivada a mano. */
export async function reactivateCard(id: string) {
  const user = await requireUser();

  const { count } = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: { isActive: true },
  });

  if (count === 0) {
    throw new Error("Tarjeta no encontrada");
  }

  revalidatePath("/tarjetas");
}
