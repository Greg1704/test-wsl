"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_PREFIX, seedDemoData } from "@/server/lib/demo-data";

/**
 * Rate limit del alta de demos, respaldado en la DB (no en memoria). El endpoint es
 * público y crea filas, así que sin freno alguien podría llenarte Neon a fuerza de
 * clicks. Se apoya en el estado compartido que YA tenemos —la propia DB— en vez de
 * sumar Redis: es serverless-safe (cada función efímera ve el mismo conteo) y respeta
 * la decisión de ARCHITECTURE.md de no meter infra extra en el MVP. El día que haya
 * tráfico real, el camino "correcto" (Upstash/INCR con TTL) ya está documentado ahí.
 *
 * Dos frenos combinados en una ventana móvil:
 * - Por IP: tope bajo, corta el spam de un mismo origen.
 * - Global: red de seguridad contra IPs rotadas/spoofeadas (acota el crecimiento de
 *   la DB aunque sacrifique disponibilidad del demo bajo ataque — trade-off aceptable
 *   para un portfolio).
 */
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const PER_IP_LIMIT = 5;
const GLOBAL_LIMIT = 40;

/** IP del cliente detrás del proxy de Vercel (primer hop de x-forwarded-for). */
function clientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip");
}

/**
 * Inicia una sesión de demo aislada (Opción B: sandbox efímero por visitante).
 *
 * Cada llamada crea un usuario NUEVO y propio (`demo-<random>@…`), lo siembra con
 * un dataset realista y lo deja logueado al instante —sin que la persona tipee
 * credenciales—. Así dos visitantes concurrentes nunca se pisan y nadie hereda lo
 * que tocó el anterior. Los usuarios quedan marcados por el prefijo del email; el
 * cron `/api/cron/demo-cleanup` los reapea pasadas unas horas (cascade borra todo
 * lo que cuelga del usuario).
 *
 * El auto-login funciona gracias al plugin `nextCookies` (ver src/lib/auth.ts):
 * `signUpEmail`, llamado desde esta Server Action, deja la cookie de sesión escrita.
 */
export async function startDemoSession(): Promise<void> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  // Freno antes de crear nada: contamos las altas demo recientes por IP y globales.
  // El filtro por email demo asegura que el rate limit solo mira este flujo, no las
  // sesiones/altas reales. Si `ipAddress` no viniera poblado (algún proxy raro), el
  // freno por IP queda inerte y el tope global igual protege.
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const demoEmailFilter = {
    startsWith: DEMO_EMAIL_PREFIX,
    endsWith: `@${DEMO_EMAIL_DOMAIN}`,
  };
  const [ipCount, globalCount] = await Promise.all([
    ip
      ? prisma.session.count({
          where: {
            ipAddress: ip,
            createdAt: { gte: since },
            user: { email: demoEmailFilter },
          },
        })
      : Promise.resolve(0),
    prisma.user.count({
      where: { email: demoEmailFilter, createdAt: { gte: since } },
    }),
  ]);

  if ((ip && ipCount >= PER_IP_LIMIT) || globalCount >= GLOBAL_LIMIT) {
    throw new Error(
      "Hay muchas sesiones demo abiertas en este momento. Probá de nuevo en unos minutos."
    );
  }

  // Email único e imposible de adivinar; password aleatoria (nadie la usa: el login
  // es automático). El dominio `.local` no es enrutable ⇒ estos usuarios no reciben
  // mails ni colisionan con cuentas reales.
  const email = `${DEMO_EMAIL_PREFIX}${randomUUID()}@${DEMO_EMAIL_DOMAIN}`;
  const password = randomBytes(24).toString("base64url");

  // Crea el usuario, dispara el hook que siembra categorías y —vía nextCookies—
  // setea la cookie de sesión (autoSignIn viene activo por defecto). Le pasamos los
  // headers del request para que Better Auth registre la IP en la Session (la que
  // lee el rate limit de arriba).
  const result = await auth.api.signUpEmail({
    body: { email, password, name: "Invitado Demo" },
    headers: requestHeaders,
  });

  await seedDemoData(prisma, result.user.id);
}
