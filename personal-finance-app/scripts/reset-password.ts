import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Reset de contraseña para DESARROLLO LOCAL.
 *
 * Uso:
 *   tsx scripts/reset-password.ts                      # lista los usuarios
 *   tsx scripts/reset-password.ts <email> <password>   # resetea
 *
 * Usa el hasher de Better Auth (scrypt) para que el hash sea compatible con el
 * login. No tocar el campo Account.password a mano.
 */
async function main() {
  const [email, newPassword] = process.argv.slice(2);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    if (!email) {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true },
        orderBy: { createdAt: "asc" },
      });
      console.log(`Usuarios (${users.length}):`);
      for (const u of users) {
        console.log(`  · ${u.email}${u.name ? ` (${u.name})` : ""}`);
      }
      console.log("\nReset: tsx scripts/reset-password.ts <email> <password>");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(`No existe un usuario con el email ${email}`);
    }

    // Hasher de Better Auth (mismo algoritmo que usa el login).
    const auth = betterAuth({
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      emailAndPassword: { enabled: true },
    });
    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(newPassword);

    // La cuenta email/password se guarda con providerId "credential".
    const { count } = await prisma.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: hashed },
    });

    if (count === 0) {
      throw new Error(
        "El usuario no tiene una cuenta de email/password (¿se registró por otro medio?)."
      );
    }

    console.log(`✓ Contraseña actualizada para ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
