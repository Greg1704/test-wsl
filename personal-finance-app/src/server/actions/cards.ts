"use server";

import { revalidatePath } from "next/cache";

import type { Card } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { cardSchema, renewCardSchema } from "@/lib/validation/card";
import { parseExpiration, startOfToday } from "@/server/lib/dates";

/** Tarjetas vigentes: activas y sin vencer. */
export async function listActiveCards() {
  const user = await requireUser();
  return prisma.card.findMany({
    where: { userId: user.id, isActive: true, expirationDate: { gte: startOfToday() } },
    orderBy: { createdAt: "desc" },
  });
}

/** Tarjetas vencidas: siguen activas pero su fecha de vencimiento ya pasó. */
export async function listExpiredCards() {
  const user = await requireUser();
  return prisma.card.findMany({
    where: { userId: user.id, isActive: true, expirationDate: { lt: startOfToday() } },
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
  | { status: "created"; card: Card }
  | { status: "duplicate"; existing: Card };

export async function createCard(input: unknown, force = false): Promise<CreateCardResult> {
  const user = await requireUser();
  const { expiration, ...data } = cardSchema.parse(input);

  if (!force) {
    // Duplicado = mismo banco + últimos 4 (entre activas, vencidas y desactivadas).
    const existing = await prisma.card.findFirst({
      where: { userId: user.id, bank: data.bank, last4: data.last4 },
    });
    if (existing) {
      return { status: "duplicate", existing };
    }
  }

  const card = await prisma.card.create({
    // El userId SIEMPRE viene de la sesión, nunca del input del cliente.
    data: { ...data, expirationDate: parseExpiration(expiration), userId: user.id },
  });

  revalidatePath("/tarjetas");
  return { status: "created", card };
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
  const { expiration, ...data } = cardSchema.parse(input);

  // updateMany filtra por userId: el usuario A no puede editar la tarjeta de B.
  const { count } = await prisma.card.updateMany({
    where: { id, userId: user.id },
    data: { ...data, expirationDate: parseExpiration(expiration) },
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
