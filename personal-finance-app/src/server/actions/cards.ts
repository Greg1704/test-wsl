"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { cardSchema } from "@/lib/validation/card";

export async function createCard(input: unknown) {
  const user = await requireUser();
  const data = cardSchema.parse(input);

  const card = await prisma.card.create({
    // El userId SIEMPRE viene de la sesión, nunca del input del cliente.
    data: { ...data, userId: user.id },
  });

  revalidatePath("/dashboard");
  return card;
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

export async function deleteCard(id: string) {
  const user = await requireUser();

  const { count } = await prisma.card.deleteMany({
    where: { id, userId: user.id },
  });

  if (count === 0) {
    throw new Error("Tarjeta no encontrada");
  }

  revalidatePath("/dashboard");
}
