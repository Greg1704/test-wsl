import Link from "next/link";

import { requireUser } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Garantiza sesión en todo el grupo (dashboard); si no hay, redirige a /login.
  await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              CuotApp
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/tarjetas"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Tarjetas
              </Link>
              <Link
                href="/compras"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Compras
              </Link>
              <Link
                href="/calendario"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Calendario
              </Link>
              <Link
                href="/configuracion"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Configuración
              </Link>
            </div>
          </div>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
