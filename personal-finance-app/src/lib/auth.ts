import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";
import { createDefaultCategoriesFor } from "@/server/lib/categories";
import { sendResetPasswordEmail } from "@/server/email/send";

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
    // Recuperación de contraseña por link de un solo uso (RF de mails). Better Auth
    // genera el token y arma la `url` apuntando al `redirectTo` que pide el cliente
    // (/reset-password); acá solo mandamos el mail.
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({ to: user.email, url });
    },
    // El token de reset vence en 1 hora (coincide con el texto del mail).
    resetPasswordTokenExpiresIn: 60 * 60,
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
      monthlyReportEnabled: {
        type: "boolean",
        defaultValue: false,
        // No se setea en el signup; se cambia desde Configuración (settings action).
        input: false,
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
  // nextCookies DEBE ir último: intercepta las respuestas de `auth.api.*` llamadas
  // dentro de una Server Action y escribe las cookies (sesión) vía `cookies()` de
  // Next. Sin esto, provisionar+loguear el invitado demo desde una Server Action
  // (ver src/server/actions/demo.ts) crearía el usuario pero NO dejaría la sesión.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
