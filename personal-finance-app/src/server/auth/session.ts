import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, type Session } from "@/lib/auth";

/** Devuelve la sesión actual (o `null`) leyendo las cookies del request. */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Para Server Components / Server Actions: garantiza que haya sesión.
 * Si no hay, redirige a /login y nunca retorna.
 */
export async function requireUser(): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
}
