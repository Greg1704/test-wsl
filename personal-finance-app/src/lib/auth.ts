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
  user: {
    additionalFields: {
      defaultCurrency: {
        type: "string",
        defaultValue: "ARS",
      },
      monthlyIncomeCents: {
        type: "number",
        defaultValue: 0,
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
