import "server-only";

import type { MonthlyReportContent } from "@/server/lib/monthly-report";
import { EMAIL_FROM, getResend } from "./client";
import { ResetPasswordEmail } from "./templates/reset-password";
import { MonthlyReportEmail } from "./templates/monthly-report";

/**
 * Manda el mail de recuperación de contraseña. Lo invoca el callback
 * `sendResetPassword` de Better Auth (ver `src/lib/auth.ts`), que arma la `url`
 * con el token de un solo uso.
 */
export async function sendResetPasswordEmail({ to, url }: { to: string; url: string }) {
  const { error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Restablecé tu contraseña de CuotApp",
    react: ResetPasswordEmail({ url }),
  });

  if (error) {
    // No filtramos el detalle al usuario (la UI muestra un mensaje neutro), pero lo
    // logueamos para diagnóstico. Lanzamos para que Better Auth marque el fallo.
    console.error("[email] No se pudo enviar el mail de reset:", error);
    throw new Error("No se pudo enviar el mail de recuperación.");
  }
}

/**
 * Manda el mail mensual de deudas. Lo invoca el cron `/api/cron/monthly-report` por
 * cada usuario con opt-in y deuda en el mes. Devuelve `true` si se envió, `false` si
 * Resend reportó error (el cron loguea y sigue con el resto, sin abortar el lote).
 */
export async function sendMonthlyReportEmail({
  to,
  content,
}: {
  to: string;
  content: MonthlyReportContent;
}): Promise<boolean> {
  const { error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: content.subject,
    react: MonthlyReportEmail({ content }),
  });

  if (error) {
    console.error(`[email] No se pudo enviar el reporte mensual a ${to}:`, error);
    return false;
  }
  return true;
}
