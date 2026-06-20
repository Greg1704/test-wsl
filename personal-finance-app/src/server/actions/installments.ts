"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { InstallmentStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";

/**
 * Cambia el estado de una cuota verificando que pertenezca al usuario de la
 * sesión. `Installment` NO tiene `userId` propio: la autorización va SIEMPRE por
 * la relación `purchase: { userId }` (RNF-1.1). Devuelve el `purchaseId` para
 * revalidar la página de detalle.
 */
async function setInstallmentStatus(id: string, data: Prisma.InstallmentUpdateInput) {
  const user = await requireUser();

  const installment = await prisma.installment.findFirst({
    where: { id, purchase: { userId: user.id } },
    select: { id: true, purchaseId: true },
  });
  if (!installment) {
    throw new Error("Cuota no encontrada");
  }

  await prisma.installment.update({ where: { id: installment.id }, data });

  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  revalidatePath("/compras");
  revalidatePath(`/compras/${installment.purchaseId}`);
}

/**
 * Marca una cuota como pagada, registrando la fecha de pago (RF-4.2). `paidFromSavings`
 * (default true) indica si la cuota se descontó del ahorro: el puente cuota↔ahorro lo
 * usa `getSavingsOverview` para bajar el saldo real (ver src/server/lib/savings.ts).
 */
export async function markInstallmentPaid(id: string, paidFromSavings = true) {
  await setInstallmentStatus(id, {
    status: InstallmentStatus.PAID,
    paidAt: new Date(),
    paidFromSavings,
  });
}

/** Revierte una cuota pagada a pendiente, limpiando fecha de pago y el flag de ahorro. */
export async function revertInstallment(id: string) {
  await setInstallmentStatus(id, {
    status: InstallmentStatus.PENDING,
    paidAt: null,
    paidFromSavings: false,
  });
}
