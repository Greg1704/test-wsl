import Link from "next/link";

import { requireUser } from "@/server/auth/session";
import {
  getMonthlyOverview,
  getOnboardingStatus,
  listInstallmentsByMonth,
} from "@/server/actions/dashboard";
import { computeDisplayStatus } from "@/server/lib/installment-status";
import { completedSteps } from "@/server/lib/onboarding";
import { formatMoney } from "@/server/lib/money";
import {
  addMonths,
  formatDate,
  formatMonthParam,
  formatMonthYear,
  monthParamToDate,
} from "@/server/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonthInstallmentsDialog } from "@/components/compras/month-installments-dialog";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { NextStepBanner } from "@/components/dashboard/next-step-banner";

type SearchParams = { month?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const userName = user.name?.trim() ?? "";

  // Onboarding: con menos de 2 pasos de alta hechos, la ventana principal es la
  // checklist en lugar del dashboard. Se evalúa antes de pedir los datos del mes.
  const onboarding = await getOnboardingStatus();
  if (completedSteps(onboarding) < 2) {
    return <OnboardingChecklist name={userName} flags={onboarding} />;
  }

  // Mes navegable (RF-5.3); por defecto, el mes actual.
  const month = monthParamToDate(sp.month) ?? new Date();
  const [overview, installments] = await Promise.all([
    getMonthlyOverview(month),
    listInstallmentsByMonth(month),
  ]);

  // DTO mínimo y serializable para el modal (regla rsc-y-payload): sin BigInt ni
  // Date; estado ya computado y monto/fecha formateados en el server.
  const installmentViews = installments.map((i) => ({
    id: i.id,
    description: i.purchase.description,
    cardName: i.purchase.card.name,
    cardLast4: i.purchase.card.last4,
    installmentNumber: i.installmentNumber,
    totalInstallments: i.purchase.totalInstallments,
    dueDate: formatDate(i.dueDate),
    amount: formatMoney(i.amountCents, i.currency),
    status: computeDisplayStatus(i.status, i.dueDate),
  }));

  const prevMonth = formatMonthParam(addMonths(month, -1));
  const nextMonth = formatMonthParam(addMonths(month, 1));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {userName || "👋"}
          </h1>
          <p className="text-muted-foreground text-sm">Tu resumen de cuotas mes a mes.</p>
        </div>
        {overview.overdueCount > 0 && (
          <Badge variant="destructive" asChild>
            <Link href="/calendario">
              {overview.overdueCount}{" "}
              {overview.overdueCount === 1 ? "cuota vencida" : "cuotas vencidas"}
            </Link>
          </Badge>
        )}
      </header>

      {/* Navegación mes a mes (RF-5.3) */}
      <div className="flex items-center justify-between rounded-lg border px-2 py-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard?month=${prevMonth}`} aria-label="Mes anterior">
            ‹
          </Link>
        </Button>
        <span className="text-sm font-medium capitalize">{formatMonthYear(month)}</span>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard?month=${nextMonth}`} aria-label="Mes siguiente">
            ›
          </Link>
        </Button>
      </div>

      {installmentViews.length > 0 && (
        <div className="flex justify-end">
          <MonthInstallmentsDialog
            monthLabel={formatMonthYear(month)}
            installments={installmentViews}
          />
        </div>
      )}

      {/* Banner generalizado: empuja al único paso de alta que falte (ingreso,
          tarjeta o compra). No renderiza nada con los 3 pasos hechos. */}
      <NextStepBanner flags={onboarding} />

      <div className="grid gap-4">
        {overview.currencies.map((c) => (
          <section key={c.currency} className="grid gap-3 rounded-xl border p-4">
            <h2 className="text-sm font-medium text-muted-foreground">{c.currency}</h2>

            {c.netCents !== null && (
              <div>
                <p className="text-muted-foreground text-xs">Disponible neto</p>
                <p
                  className={`text-2xl font-semibold ${c.netCents < 0n ? "text-destructive" : ""}`}
                >
                  {formatMoney(c.netCents, c.currency)}
                </p>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {c.incomeCents !== null && (
                <div>
                  <p className="text-muted-foreground text-xs">Ingreso</p>
                  <p className="font-medium">{formatMoney(c.incomeCents, c.currency)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">Cuotas del mes</p>
                <p className="font-medium">{formatMoney(c.committedCents, c.currency)}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Próximos vencimientos: relativo a HOY, no al mes navegado (por eso va
          fuera de las tarjetas por-mes). Una fila por moneda con cuota próxima. */}
      <section className="grid gap-2 rounded-xl border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Próximos vencimientos</h2>
        {overview.currencies.some((c) => c.nextDue) ? (
          <ul className="grid gap-1 text-sm">
            {overview.currencies.map((c) =>
              c.nextDue ? (
                <li key={c.currency} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {c.currency} · {formatDate(c.nextDue.dueDate)}
                  </span>
                  <span className="font-medium">
                    {formatMoney(c.nextDue.amountCents, c.currency)}
                  </span>
                </li>
              ) : null
            )}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Sin próximos vencimientos</p>
        )}
      </section>
    </main>
  );
}
