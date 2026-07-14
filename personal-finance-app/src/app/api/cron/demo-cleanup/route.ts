import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_PREFIX } from "@/server/lib/demo-data";

// Cron de limpieza de usuarios demo efímeros (Opción B). Lo dispara Vercel Cron
// (ver vercel.json). No se cachea: cada corrida evalúa el estado actual.
export const dynamic = "force-dynamic";

/** Edad a partir de la cual un sandbox demo se considera abandonado y se borra. */
const DEMO_MAX_AGE_HOURS = 24;

/**
 * Borra los usuarios demo con más de `DEMO_MAX_AGE_HOURS` de antigüedad. Cada visita
 * a "Probar demo" crea un usuario propio (ver src/server/actions/demo.ts); sin esto
 * se acumularían en Neon. Borrar la fila del User arrastra en cascada tarjetas,
 * compras, cuotas, ingresos, ahorro y sesiones (onDelete: Cascade en el schema).
 *
 * Protegido por `CRON_SECRET`: Vercel lo inyecta como `Authorization: Bearer <secret>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - DEMO_MAX_AGE_HOURS * 60 * 60 * 1000);

  const { count } = await prisma.user.deleteMany({
    where: {
      email: { startsWith: DEMO_EMAIL_PREFIX, endsWith: `@${DEMO_EMAIL_DOMAIN}` },
      createdAt: { lt: cutoff },
    },
  });

  return NextResponse.json({ deleted: count });
}
