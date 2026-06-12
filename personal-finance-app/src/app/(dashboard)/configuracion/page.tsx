import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { centsToCurrency } from "@/server/lib/money";
import { IncomeForm } from "@/components/configuracion/income-form";

export default async function ConfiguracionPage() {
  const user = await requireUser();

  // Server Component: lee la DB directo. Pasa un DTO mínimo al form (regla
  // rsc-y-payload): el ingreso ya en pesos (number), no BigInt.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { monthlyIncomeCents: true, defaultCurrency: true },
  });

  // Ingreso sin configurar (0) ⇒ input VACÍO (no un "0" pegado que no se puede borrar).
  const incomeCents = profile?.monthlyIncomeCents ?? 0n;
  const initial = {
    monthlyIncome: incomeCents > 0n ? centsToCurrency(incomeCents) : undefined,
    defaultCurrency: (profile?.defaultCurrency === "USD" ? "USD" : "ARS") as "ARS" | "USD",
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Tu ingreso mensual y moneda principal para calcular el disponible neto.
        </p>
      </header>

      <IncomeForm initial={initial} />
    </main>
  );
}
