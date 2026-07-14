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
  // Rate limiting de los endpoints de auth (fuerza bruta de login + "email bombing"
  // del reset de contraseña, que puede agotar la cuota de Resend o inundar la casilla
  // de una víctima). `enabled` queda en su default (ACTIVO SOLO EN PRODUCCIÓN): así no
  // interfiere con el dev ni con el E2E, que es donde se martillan estos endpoints.
  //
  // LIMITACIÓN CONOCIDA (MVP): el store por defecto es EN MEMORIA. En Vercel serverless
  // las instancias son efímeras y no comparten memoria, así que el conteo no es 100%
  // confiable entre invocaciones. Mitiga el caso básico; el endurecimiento real es un
  // store compartido (Upstash/Vercel KV vía `secondaryStorage`), ya documentado en
  // docs/ARCHITECTURE.md → "Redis para rate limit". Estas reglas suben la vara mientras
  // tanto, sobre todo en los endpoints sensibles.
  rateLimit: {
    window: 60, //  ventana de 60s
    max: 60, //     tope global por IP/ventana (baseline para todo /api/auth)
    customRules: {
      // Login: acotar los intentos por ventana frena el brute-force de contraseñas.
      "/sign-in/email": { window: 60, max: 8 },
      // Alta de cuenta: limita el spam de registros.
      "/sign-up/email": { window: 60, max: 5 },
      // Pedido de reset (el más abusable): 1 por minuto por IP. Se cubren los dos nombres
      // de ruta posibles según versión de Better Auth; la que no exista es inofensiva.
      "/request-password-reset": { window: 60, max: 1 },
      "/forget-password": { window: 60, max: 1 },
    },
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
