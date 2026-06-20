import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/server/db";
import { createDefaultCategoriesFor } from "@/server/lib/categories";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Orígenes extra confiables además de BETTER_AUTH_URL (coma-separados). Lo usa
  // el E2E en Docker, donde el browser entra por http://cuotapp:3000 mientras la
  // app se declara como localhost:3000 (sin esto, Better Auth rechaza los POST).
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [],
  emailAndPassword: {
    enabled: true,
  },
  session: {
    // La sesión vence a las 2h de su último refresco; `updateAge` evita escribir
    // en la DB en cada request: solo "empuja" el expiresAt si la sesión tiene más
    // de 1h. En la práctica, usándola al menos 1 vez por hora se renueva sola; con
    // >2h de inactividad, el próximo acceso cae en /login.
    expiresIn: 60 * 60 * 2, // 2 horas
    updateAge: 60 * 60, //     1 hora
  },
  user: {
    additionalFields: {
      defaultCurrency: {
        type: "string",
        defaultValue: "ARS",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Tras un signup exitoso, sembramos las categorías por defecto (RF-7.2).
        after: async (user) => {
          await createDefaultCategoriesFor(prisma, user.id);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
