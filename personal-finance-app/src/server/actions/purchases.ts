"use server";

import { revalidatePath } from "next/cache";
import { startOfMonth, addMonths } from "date-fns";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import {
  purchaseSchema,
  editPurchaseSchema,
  purchaseFiltersSchema,
  NO_CATEGORY_FILTER,
} from "@/lib/validation/purchase";
import { currencyToCents } from "@/server/lib/money";
import { generateInstallments, impliedMonthlyRate } from "@/server/lib/installments";

export async function createPurchase(input: unknown) {
  const user = await requireUser();
  const data = purchaseSchema.parse(input);

  // La tarjeta debe pertenecer al usuario de la sesión (autorización).
  const card = await prisma.card.findFirst({
    where: { id: data.cardId, userId: user.id },
  });
  if (!card) {
    throw new Error("Tarjeta no encontrada");
  }

  // La categoría (si se asigna) también debe pertenecer al usuario: la FK de
  // Prisma garantiza existencia, no ownership.
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: user.id },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Categoría no encontrada");
    }
  }

  // Monto original (lo que costó) vs. total financiado (con recargo). Si no se
  // informa recargo, son iguales = compra sin interés.
  const originalCents = currencyToCents(data.totalAmount);
  const financedCents =
    data.financedTotal != null ? currencyToCents(data.financedTotal) : originalCents;

  // Las cuotas reparten SIEMPRE el total final.
  const rows = generateInstallments({
    cardClosingDay: card.closingDay,
    cardDueDay: card.dueDay,
    purchaseDate: data.purchaseDate,
    totalInstallments: data.totalInstallments,
    totalAmountCents: financedCents,
    currency: data.currency,
  });

  // TEM derivada del recargo (solo para mostrar). null si no hay recargo.
  const monthlyRate = impliedMonthlyRate(
    originalCents,
    financedCents,
    data.totalInstallments
  );

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        userId: user.id,
        cardId: data.cardId,
        categoryId: data.categoryId,
        description: data.description,
        merchant: data.merchant,
        totalAmountCents: originalCents,
        currency: data.currency,
        totalInstallments: data.totalInstallments,
        purchaseDate: data.purchaseDate,
        firstInstallmentDueDate: rows[0].dueDate,
        interestRateMonthly: monthlyRate > 0 ? monthlyRate : null,
        notes: data.notes,
      },
    });

    await tx.installment.createMany({
      data: rows.map((row) => ({ ...row, purchaseId: created.id })),
    });

    return created;
  });

  revalidatePath("/dashboard");
  revalidatePath("/compras");
  // Devolvemos solo el id (string): el objeto Prisma trae `Decimal`/`BigInt` no
  // serializables y rompería el borde Server Action → Client al retornar.
  return { id: purchase.id };
}

/**
 * Listado de compras del usuario con filtros opcionales (RF-3.8).
 * El `userId` SIEMPRE proviene de la sesión; "mes" filtra por `purchaseDate`.
 */
export async function listPurchases(filters: unknown = {}) {
  const user = await requireUser();
  const { cardId, categoryId, currency, month } = purchaseFiltersSchema.parse(filters);

  const where: Prisma.PurchaseWhereInput = { userId: user.id };
  if (cardId) where.cardId = cardId;
  // "Sin categoría" filtra las compras con categoryId null; un id filtra esa categoría.
  if (categoryId === NO_CATEGORY_FILTER) where.categoryId = null;
  else if (categoryId) where.categoryId = categoryId;
  if (currency) where.currency = currency;
  if (month) {
    // Borde superior EXCLUSIVO (`lt` al inicio del mes siguiente). Con `lte:
    // endOfMonth` el wall-clock local 23:59:59 cae el día 1 siguiente en UTC
    // (en AR, UTC-3), y una compra `@db.Date` del día 1 leakearía a este mes.
    where.purchaseDate = {
      gte: startOfMonth(month),
      lt: startOfMonth(addMonths(month, 1)),
    };
  }

  return prisma.purchase.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
    include: {
      card: { select: { id: true, name: true, bank: true, last4: true } },
      category: { select: { id: true, name: true, color: true } },
      _count: { select: { installments: true } },
    },
  });
}

/**
 * Edita SOLO campos descriptivos de una compra (RF-3.6). No recalcula cuotas:
 * el monto, la cantidad de cuotas y la fecha quedan congelados al alta.
 */
export async function updatePurchase(id: string, input: unknown) {
  const user = await requireUser();
  const data = editPurchaseSchema.parse(input);

  // Si se asigna una categoría, debe pertenecer al usuario (autorización).
  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId: user.id },
      select: { id: true },
    });
    if (!category) {
      throw new Error("Categoría no encontrada");
    }
  }

  // Solo escribimos las claves presentes en el payload: un update parcial no
  // debe pisar con NULL lo que el caller no envió. `null` explícito sí limpia.
  const patch: Prisma.PurchaseUncheckedUpdateManyInput = {
    description: data.description,
  };
  if ("categoryId" in data) patch.categoryId = data.categoryId ?? null;
  if ("merchant" in data) patch.merchant = data.merchant ?? null;
  if ("notes" in data) patch.notes = data.notes ?? null;

  // updateMany filtra por userId: el usuario A no puede editar la compra de B.
  const { count } = await prisma.purchase.updateMany({
    where: { id, userId: user.id },
    data: patch,
  });

  if (count === 0) {
    throw new Error("Compra no encontrada");
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/${id}`);
}

/**
 * Elimina una compra y, en cascada, todas sus cuotas (RF-3.7).
 * El borrado de cuotas lo hace el `onDelete: Cascade` del schema.
 */
export async function deletePurchase(id: string) {
  const user = await requireUser();

  const { count } = await prisma.purchase.deleteMany({
    where: { id, userId: user.id },
  });

  if (count === 0) {
    throw new Error("Compra no encontrada");
  }

  revalidatePath("/dashboard");
  revalidatePath("/compras");
}

export async function getPurchaseById(id: string) {
  const user = await requireUser();

  const purchase = await prisma.purchase.findFirst({
    where: { id, userId: user.id },
    include: {
      card: true,
      category: true,
      installments: { orderBy: { installmentNumber: "asc" } },
    },
  });

  if (!purchase) {
    throw new Error("Compra no encontrada");
  }
  return purchase;
}
