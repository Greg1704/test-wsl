import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createDefaultCategoriesFor, DEFAULT_CATEGORIES } from "../src/server/lib/categories";

/**
 * Backfill de categorías por defecto para usuarios que aún no tienen ninguna.
 * El alta normal de categorías ocurre en el hook post-signup de Better Auth
 * (ver src/lib/auth.ts); este seed sirve para cuentas creadas antes del hook
 * o para reinicializar una DB de desarrollo.
 *
 * Uso: npm run db:seed
 */
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const usersWithoutCategories = await prisma.user.findMany({
      where: { categories: { none: {} } },
      select: { id: true },
    });

    for (const user of usersWithoutCategories) {
      await createDefaultCategoriesFor(prisma, user.id);
    }

    console.log(
      `Seed listo: ${DEFAULT_CATEGORIES.length} categorías por usuario · ` +
        `${usersWithoutCategories.length} usuario(s) inicializado(s).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
