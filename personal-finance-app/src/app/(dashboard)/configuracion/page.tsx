import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { centsToCurrency } from "@/server/lib/money";
import { incomeForMonth } from "@/server/lib/savings";
import { startOfMonth } from "@/server/lib/dates";
import { IncomeForm } from "@/components/configuracion/income-form";
import { SavingsForm } from "@/components/configuracion/savings-form";
import { NotificationsForm } from "@/components/configuracion/notifications-form";
import { CreditLimitForm } from "@/components/configuracion/credit-limit-form";
import { Separator } from "@/components/ui/separator";

/** Ingreso vigente del mes actual para una moneda, en unidades (number) o undefined. */
function currentIncome(
  rows: { currency: string; amountCents: bigint; validFrom: Date }[],
  currency: string
): number | undefined {
  const entries = rows.filter((r) => r.currency === currency);
  if (entries.length === 0) return undefined;
  const cents = incomeForMonth(entries, startOfMonth(new Date()));
  return cents > 0n ? centsToCurrency(cents) : undefined;
}

export default async function ConfiguracionPage() {
  const user = await requireUser();

  // Server Component: lee la DB directo. Pasa un DTO mínimo al form (regla
  // rsc-y-payload): los montos ya en unidades (number), no BigInt.
  const [profile, incomeRows, savingsRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        defaultCurrency: true,
        monthlyReportEnabled: true,
        trackCreditLimits: true,
      },
    }),
    prisma.incomeEntry.findMany({
      where: { userId: user.id },
      select: { currency: true, amountCents: true, validFrom: true },
    }),
    prisma.savingsBalance.findMany({
      where: { userId: user.id },
      select: { currency: true, amountCents: true, asOf: true },
    }),
  ]);

  const initial = {
    defaultCurrency: (profile?.defaultCurrency === "USD" ? "USD" : "ARS") as "ARS" | "USD",
    incomeArs: currentIncome(incomeRows, "ARS"),
    incomeUsd: currentIncome(incomeRows, "USD"),
  };

  const savingsAmount = (currency: string): number | undefined => {
    const row = savingsRows.find((s) => s.currency === currency);
    return row ? centsToCurrency(row.amountCents) : undefined;
  };
  // Instante de la última declaración por moneda (ISO string: `asOf` es un Date, se
  // formatea en el navegador con la TZ real del usuario). `null` si nunca se declaró.
  const savingsUpdatedAt = (currency: string): string | null => {
    const row = savingsRows.find((s) => s.currency === currency);
    return row ? row.asOf.toISOString() : null;
  };
  const savingsInitial = {
    savingsArs: savingsAmount("ARS"),
    savingsUsd: savingsAmount("USD"),
    updatedArs: savingsUpdatedAt("ARS"),
    updatedUsd: savingsUpdatedAt("USD"),
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Tu ingreso mensual por moneda y la moneda principal para calcular el disponible neto.
        </p>
      </header>

      <IncomeForm initial={initial} />

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Ahorro</h2>
          <p className="text-muted-foreground text-sm">
            Tu saldo guardado, por moneda. Es la base del seguimiento de ahorro del dashboard.
          </p>
        </div>
        <SavingsForm initial={savingsInitial} />
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Notificaciones</h2>
          <p className="text-muted-foreground text-sm">
            Recordatorios por mail sobre tus cuotas.
          </p>
        </div>
        <NotificationsForm initialEnabled={profile?.monthlyReportEnabled ?? false} />
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Límite de crédito</h2>
          <p className="text-muted-foreground text-sm">
            Seguimiento opcional de cuánto de cada tarjeta está comprometido en cuotas.
          </p>
        </div>
        <CreditLimitForm
          initialEnabled={profile?.trackCreditLimits ?? false}
          mainCurrency={initial.defaultCurrency}
        />
      </section>
    </div>
  );
}
