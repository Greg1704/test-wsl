import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { startOfMonth } from "@/server/lib/dates";
import { buildMonthlyReport, hasDebtThisMonth } from "@/server/lib/monthly-report";
import { getMonthlyOverviewForUser } from "@/server/queries/monthly-overview";
import { sendMonthlyReportEmail } from "@/server/email/send";

// Cron del reporte mensual de deudas (RF de mails). Lo dispara Vercel Cron el día 1
// (ver vercel.json). No se cachea: cada corrida lee el estado actual de la DB.
export const dynamic = "force-dynamic";

/**
 * Endpoint del reporte mensual. Protegido por `CRON_SECRET`: Vercel lo inyecta como
 * header `Authorization: Bearer <CRON_SECRET>` al disparar el cron. Itera los usuarios
 * con opt-in (`monthlyReportEnabled`) y, a los que tienen deuda en el mes, les manda el
 * mail. Envío secuencial para respetar el rate limit de Resend (5 req/s, 100/día).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const month = startOfMonth(new Date());

  const users = await prisma.user.findMany({
    where: { monthlyReportEnabled: true },
    select: { id: true, email: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const overview = await getMonthlyOverviewForUser(user.id, month);
    if (!hasDebtThisMonth(overview)) {
      skipped++;
      continue;
    }
    const content = buildMonthlyReport(overview, month);
    const ok = await sendMonthlyReportEmail({ to: user.email, content });
    if (ok) sent++;
    else failed++;
  }

  return NextResponse.json({ processed: users.length, sent, skipped, failed });
}
