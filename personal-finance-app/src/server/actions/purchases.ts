"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { purchaseSchema } from "@/lib/validation/purchase";
import { currencyToCents } from "@/server/lib/money";
import { generateInstallments } from "@/server/lib/installments";

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

  const totalAmountCents = currencyToCents(data.totalAmount);

  const rows = generateInstallments({
    cardClosingDay: card.closingDay,
    cardDueDay: card.dueDay,
    purchaseDate: data.purchaseDate,
    totalInstallments: data.totalInstallments,
    totalAmountCents,
    interestRateMonthly: data.interestRateMonthly,
    currency: data.currency,
  });

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        userId: user.id,
        cardId: data.cardId,
        categoryId: data.categoryId,
        description: data.description,
        merchant: data.merchant,
        totalAmountCents,
        currency: data.currency,
        totalInstallments: data.totalInstallments,
        purchaseDate: data.purchaseDate,
        firstInstallmentDueDate: rows[0].dueDate,
        interestRateMonthly: data.interestRateMonthly ?? null,
        notes: data.notes,
      },
    });

    await tx.installment.createMany({
      data: rows.map((row) => ({ ...row, purchaseId: created.id })),
    });

    return created;
  });

  revalidatePath("/dashboard");
  return purchase;
}

export async function getPurchaseById(id: string) {
  const user = await requireUser();

  const purchase = await prisma.purchase.findFirst({
    where: { id, userId: user.id },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });

  if (!purchase) {
    throw new Error("Compra no encontrada");
  }
  return purchase;
}
