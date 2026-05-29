import { requireUser } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {user.name?.trim() || "👋"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Acá va a vivir tu resumen de cuotas. Por ahora es un placeholder.
          </p>
        </div>
        <SignOutButton />
      </header>
    </main>
  );
}
