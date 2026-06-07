"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { categorySchema } from "@/lib/validation/category";

/** Categorías del usuario, ordenadas alfabéticamente (RF-7.1). */
export async function listCategories() {
  const user = await requireUser();
  return prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    // _count.purchases: cuántas compras quedarían sin categoría si se borra.
    include: { _count: { select: { purchases: true } } },
  });
}

export async function createCategory(input: unknown) {
  const user = await requireUser();
  const data = categorySchema.parse(input);

  // Evitar duplicados por nombre (case-insensitive) dentro del mismo usuario.
  const existing = await prisma.category.findFirst({
    where: { userId: user.id, name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) {
    throw new Error("Ya existe una categoría con ese nombre");
  }

  // El userId SIEMPRE viene de la sesión, nunca del input del cliente.
  const category = await prisma.category.create({
    data: { ...data, userId: user.id },
  });

  revalidatePath("/compras");
  return category;
}

export async function updateCategory(id: string, input: unknown) {
  const user = await requireUser();
  const data = categorySchema.parse(input);

  // updateMany filtra por userId: el usuario A no puede editar la categoría de B.
  const { count } = await prisma.category.updateMany({
    where: { id, userId: user.id },
    data,
  });

  if (count === 0) {
    throw new Error("Categoría no encontrada");
  }

  revalidatePath("/compras");
}

/**
 * Elimina una categoría. Las compras asociadas quedan con `categoryId: null`
 * (el schema tiene `onDelete: SetNull`), no se borran.
 */
export async function deleteCategory(id: string) {
  const user = await requireUser();

  const { count } = await prisma.category.deleteMany({
    where: { id, userId: user.id },
  });

  if (count === 0) {
    throw new Error("Categoría no encontrada");
  }

  revalidatePath("/compras");
}
