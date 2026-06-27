import { Resend } from "resend";

// Singleton de Resend (mismo patrón que el cliente Prisma): en desarrollo Next.js
// recarga los módulos en caliente, así que cachear la instancia en `globalThis` evita
// crear un cliente nuevo en cada recarga. La API key se lee de forma perezosa al primer
// envío, no al importar: así el build/typecheck no exige tenerla seteada.
const globalForResend = globalThis as unknown as { resend?: Resend };

function createClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada (ver .env.example).");
  }
  return new Resend(apiKey);
}

export function getResend(): Resend {
  const resend = globalForResend.resend ?? createClient();
  if (process.env.NODE_ENV !== "production") globalForResend.resend = resend;
  return resend;
}

/** Remitente de todos los mails. En dev se puede usar `onboarding@resend.dev`. */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "CuotApp <onboarding@resend.dev>";
