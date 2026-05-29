import type { PrismaClient } from "@/generated/prisma/client";

/** Categorías de gasto iniciales para un usuario nuevo (mercado AR). RF-7.2. */
export const DEFAULT_CATEGORIES = [
  "Indumentaria",
  "Tecnología",
  "Supermercado",
  "Servicios",
  "Salud",
  "Educación",
  "Ocio",
  "Otros",
] as const;

/** Sólo lo que necesitamos del cliente Prisma; facilita testear sin DB. */
type CategoryClient = Pick<PrismaClient, "category">;

/**
 * Crea las categorías por defecto para un usuario. Se invoca tras un signup
 * exitoso (hook de Better Auth, ver src/lib/auth.ts). El cliente se inyecta
 * para poder usar el singleton en runtime y un fake en los tests.
 */
export function createDefaultCategoriesFor(client: CategoryClient, userId: string) {
  return client.category.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ userId, name })),
  });
}
