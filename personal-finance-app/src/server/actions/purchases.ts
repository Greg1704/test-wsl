"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { monthRange } from "@/server/lib/dates";
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
  const isCredit = data.paymentMethod === "CREDIT";
  const needsCard = isCredit || data.paymentMethod === "DEBIT";

  // La tarjeta (crédito o débito) debe pertenecer al usuario y ser del tipo correcto.
  let card = null;
  if (needsCard) {
    card = await prisma.card.findFirst({ where: { id: data.cardId, userId: user.id } });
    if (!card) throw new Error("Tarjeta no encontrada");
    const expectedType = isCredit ? "CREDIT" : "DEBIT";
    if (card.type !== expectedType) throw new Error("Tipo de tarjeta inválido para el medio de pago");
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

  // Moneda de la compra: la que eligió el usuario. Con tarjeta debe ser una de las que
  // la tarjeta opera (una tarjeta puede tener ARS y USD). La Server Action es un endpoint
  // público: no alcanza con restringir el select en el cliente, se valida acá.
  const currency = data.currency;
  if (card && !card.currencies.includes(currency)) {
    throw new Error("La tarjeta no opera en esa moneda");
  }
  const originalCents = currencyToCents(data.totalAmount);

  // GASTO NO-CRÉDITO (débito/transferencia/efectivo): pago único en `purchaseDate`,
  // sin interés y SIN cuotas materializadas (no contamina el eje de cuotas; descuenta
  // del ahorro vía getSavingsOverview). Ver docs/ARCHITECTURE.md.
  if (!isCredit) {
    const created = await prisma.purchase.create({
      data: {
        userId: user.id,
        paymentMethod: data.paymentMethod,
        cardId: card?.id ?? null,
        categoryId: data.categoryId,
        description: data.description,
        merchant: data.merchant,
        totalAmountCents: originalCents,
        currency,
        totalInstallments: 1,
        purchaseDate: data.purchaseDate,
        firstInstallmentDueDate: data.purchaseDate,
        interestRateMonthly: null,
        notes: data.notes,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/compras");
    return { id: created.id };
  }

  // COMPRA A CRÉDITO: las cuotas necesitan el ciclo de la tarjeta (no nulo en crédito).
  if (card!.closingDay == null || card!.dueDay == null) {
    throw new Error("La tarjeta de crédito no tiene ciclo de facturación configurado");
  }

  // Monto original (lo que costó) vs. total financiado (con recargo). Si no se
  // informa recargo, son iguales = compra sin interés.
  const financedCents =
    data.financedTotal != null ? currencyToCents(data.financedTotal) : originalCents;

  // Las cuotas reparten SIEMPRE el total final.
  const rows = generateInstallments({
    cardClosingDay: card!.closingDay,
    cardDueDay: card!.dueDay,
    purchaseDate: data.purchaseDate,
    totalInstallments: data.totalInstallments,
    totalAmountCents: financedCents,
    currency,
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
        paymentMethod: "CREDIT",
        cardId: card!.id,
        categoryId: data.categoryId,
        description: data.description,
        merchant: data.merchant,
        totalAmountCents: originalCents,
        currency,
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

/** Cantidad de compras por página en el listado (RF-3.8). */
const PURCHASES_PAGE_SIZE = 15;

/**
 * Listado de compras del usuario con filtros opcionales y paginación (RF-3.8).
 * El `userId` SIEMPRE proviene de la sesión; "mes" filtra por `purchaseDate`. Devuelve
 * la página pedida (15 filas) más el total para los controles de paginación.
 */
export async function listPurchases(filters: unknown = {}) {
  const user = await requireUser();
  const { cardId, categoryId, currency, paymentMethod, month, page } =
    purchaseFiltersSchema.parse(filters);

  const where: Prisma.PurchaseWhereInput = { userId: user.id };
  if (cardId) where.cardId = cardId;
  // "Sin categoría" filtra las compras con categoryId null; un id filtra esa categoría.
  if (categoryId === NO_CATEGORY_FILTER) where.categoryId = null;
  else if (categoryId) where.categoryId = categoryId;
  if (currency) where.currency = currency;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  // Rango del mes con borde superior exclusivo (TZ-safe). Ver monthRange.
  if (month) where.purchaseDate = monthRange(month);

  // Cuenta total (para la paginación) y la página pedida, en paralelo. Si la página
  // queda fuera de rango, se clampa a la última con resultados.
  const total = await prisma.purchase.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PURCHASES_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page ?? 1), pageCount);

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
    skip: (currentPage - 1) * PURCHASES_PAGE_SIZE,
    take: PURCHASES_PAGE_SIZE,
    include: {
      card: { select: { id: true, name: true, bank: true, last4: true } },
      category: { select: { id: true, name: true, color: true } },
      _count: { select: { installments: true } },
    },
  });

  return { purchases, total, page: currentPage, pageCount };
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
