import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Layers,
  Receipt,
  Wallet,
} from "lucide-react";

import { requireUser } from "@/server/auth/session";
import {
  getCategoryBreakdown,
  getDebtStats,
  getMonthlyOverview,
  getOnboardingStatus,
  getProjection,
  listInstallmentsByMonth,
} from "@/server/actions/dashboard";
import { computeDisplayStatus } from "@/server/lib/installment-status";
import { completedSteps } from "@/server/lib/onboarding";
import { percentOfIncome } from "@/server/lib/dashboard";
import { centsToCurrency, formatMoney } from "@/server/lib/money";
import {
  addMonths,
  daysFromToday,
  formatDate,
  formatMonthParam,
  formatMonthYear,
  monthParamToDate,
} from "@/server/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonthInstallmentsDialog } from "@/components/compras/month-installments-dialog";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { NextStepBanner } from "@/components/dashboard/next-step-banner";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProjectionChart } from "@/components/dashboard/projection-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";

const PROJECTION_MONTHS = 12;

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
  const [overview, installments, projection, breakdown, debtStats] = await Promise.all([
    getMonthlyOverview(month),
    listInstallmentsByMonth(month),
    getProjection(month, PROJECTION_MONTHS),
    getCategoryBreakdown(month),
    getDebtStats(),
  ]);

  const { defaultCurrency } = overview;
  // La moneda principal define los KPI grandes; las demás van en una fila compacta.
  const main = overview.currencies[0];
  const otherCurrencies = overview.currencies.slice(1);
  const mainDebt = debtStats.find((d) => d.currency === defaultCurrency);
  const committedPercent = percentOfIncome(main.committedCents, main.incomeCents);

  // Las monedas se ordenan con la principal primero, igual que el overview.
  const byDefaultFirst = <T extends { currency: string }>(a: T, b: T) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0;

  // DTOs planos para los charts (Client Components): nada de BigInt ni Date;
  // los montos cruzan como number y las fechas ya formateadas (regla rsc-y-payload).
  const projectionViews = projection.sort(byDefaultFirst).map((serie) => ({
    currency: serie.currency,
    income:
      serie.currency === defaultCurrency && main.incomeCents !== null
        ? centsToCurrency(main.incomeCents)
        : null,
    cards: serie.cards,
    data: serie.months.map((m) => ({
      month: formatDate(m.month, "MMM yy"),
      ...Object.fromEntries(
        serie.cards.map((c) => [c.id, centsToCurrency(m.byCard[c.id] ?? 0n)])
      ),
    })),
  }));

  const donutViews = breakdown.sort(byDefaultFirst).map((b) => ({
    currency: b.currency,
    slices: b.slices.map((s) => ({
      key: s.id ?? "none",
      name: s.name,
      value: centsToCurrency(s.amountCents),
      color: s.color,
    })),
  }));

  // DTO mínimo y serializable para el modal de gestión de cuotas del mes.
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
  const monthLabel = formatMonthYear(month);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {userName || "👋"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Tu resumen de cuotas mes a mes.
          </p>
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

      {/* Navegación mes a mes (RF-5.3) + gestión de cuotas del mes mostrado. */}
      <div className="flex items-center justify-between gap-3 rounded-lg border px-2 py-1.5">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/dashboard?month=${prevMonth}`} aria-label="Mes anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <div className="flex items-center gap-1">
          {installmentViews.length > 0 && (
            <MonthInstallmentsDialog
              monthLabel={monthLabel}
              installments={installmentViews}
            />
          )}
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={`/dashboard?month=${nextMonth}`} aria-label="Mes siguiente">
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>

      {/* Banner generalizado: empuja al único paso de alta que falte. */}
      <NextStepBanner flags={onboarding} />

      {/* KPIs de la moneda principal. Los dos primeros siguen al mes navegado;
          deuda restante y horizonte son siempre relativos a hoy. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* La métrica estrella del producto va en la card de marca (esmeralda). */}
        <KpiCard
          title="Disponible neto"
          icon={Wallet}
          variant="brand"
          value={
            main.netCents !== null ? formatMoney(main.netCents, main.currency) : "—"
          }
          valueClassName={
            // Sobre fondo esmeralda el rojo no lee: el negativo va en rojo claro.
            main.netCents !== null && main.netCents < 0n ? "text-red-200" : undefined
          }
          hint={
            main.incomeCents !== null && main.incomeCents > 0n
              ? `Ingreso ${formatMoney(main.incomeCents, main.currency)} − cuotas del mes`
              : "Configurá tu ingreso para calcularlo"
          }
        />
        <KpiCard
          title="Cuotas del mes"
          icon={Receipt}
          value={formatMoney(main.committedCents, main.currency)}
          hint={
            committedPercent !== null
              ? `${committedPercent.toLocaleString("es-AR")}% de tu ingreso`
              : `Vencen en ${monthLabel}`
          }
        >
          {committedPercent !== null && (
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full",
                  committedPercent > 100
                    ? "bg-destructive"
                    : committedPercent > 75
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(committedPercent, 100)}%` }}
              />
            </div>
          )}
        </KpiCard>
        <KpiCard
          title="Deuda restante"
          icon={Layers}
          value={formatMoney(mainDebt?.remainingCents ?? 0n, defaultCurrency)}
          hint={
            mainDebt
              ? `${mainDebt.pendingCount} ${
                  mainDebt.pendingCount === 1 ? "cuota pendiente" : "cuotas pendientes"
                } a hoy`
              : "Sin cuotas pendientes"
          }
        />
        <KpiCard
          title="Libre de cuotas"
          icon={CalendarCheck2}
          value={
            mainDebt?.lastDueDate ? formatDate(mainDebt.lastDueDate, "MMM yyyy") : "Hoy"
          }
          valueClassName="capitalize"
          hint={
            mainDebt?.lastDueDate
              ? "Cuando vence tu última cuota pendiente"
              : "No debés ninguna cuota"
          }
        />
      </section>

      {/* Otras monedas (ej. USD): resumen compacto, nunca sumado a la principal. */}
      {otherCurrencies.map((c) => {
        const debt = debtStats.find((d) => d.currency === c.currency);
        return (
          <section
            key={c.currency}
            className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm"
          >
            <span className="text-foreground font-semibold">{c.currency}</span>
            <span>
              Cuotas del mes:{" "}
              <span className="text-foreground font-medium">
                {formatMoney(c.committedCents, c.currency)}
              </span>
            </span>
            {debt && (
              <span>
                Deuda restante:{" "}
                <span className="text-foreground font-medium">
                  {formatMoney(debt.remainingCents, c.currency)}
                </span>
              </span>
            )}
          </section>
        );
      })}

      {/* Proyección de compromisos: el diferencial del producto, ahora visible.
          Un chart por moneda (RF-9.1: jamás se mezclan). */}
      {projectionViews.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Proyección a {PROJECTION_MONTHS} meses</CardTitle>
            <CardDescription>
              No hay cuotas comprometidas desde{" "}
              <span className="capitalize">{monthLabel}</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        projectionViews.map((serie) => (
          <Card key={serie.currency}>
            <CardHeader>
              <CardTitle>
                Proyección a {PROJECTION_MONTHS} meses · {serie.currency}
              </CardTitle>
              <CardDescription>
                Cuotas comprometidas por tarjeta desde{" "}
                <span className="capitalize">{monthLabel}</span>
                {serie.income !== null && " — la línea punteada es tu ingreso"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectionChart
                currency={serie.currency}
                income={serie.income}
                cards={serie.cards}
                data={serie.data}
              />
            </CardContent>
          </Card>
        ))
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gasto del mes por categoría (RF-7.3, adelantado a Fase 3). */}
        <Card>
          <CardHeader>
            <CardTitle>Gasto por categoría</CardTitle>
            <CardDescription className="capitalize">{monthLabel}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {donutViews.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                No hay cuotas que venzan este mes.
              </p>
            ) : (
              donutViews.map((d) => (
                <div key={d.currency} className="grid gap-1">
                  {donutViews.length > 1 && (
                    <p className="text-muted-foreground text-center text-xs font-medium">
                      {d.currency}
                    </p>
                  )}
                  <CategoryDonut currency={d.currency} slices={d.slices} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Próximos vencimientos: relativos a HOY, no al mes navegado. */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimientos</CardTitle>
            <CardDescription>Tu próxima cuota en cada moneda.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.currencies.some((c) => c.nextDue) ? (
              <ul className="grid gap-3">
                {overview.currencies.map((c) => {
                  if (!c.nextDue) return null;
                  const days = daysFromToday(c.nextDue.dueDate);
                  return (
                    <li
                      key={c.currency}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    >
                      <CalendarClock className="text-muted-foreground size-4 shrink-0" />
                      <div className="grid leading-tight">
                        <span className="text-sm font-medium">
                          {formatDate(c.nextDue.dueDate)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {days === 0
                            ? "Vence hoy"
                            : days === 1
                              ? "Vence mañana"
                              : `En ${days} días`}
                        </span>
                      </div>
                      <span className="ml-auto font-medium">
                        {formatMoney(c.nextDue.amountCents, c.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground py-10 text-center text-sm">
                Sin próximos vencimientos. 🎉
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
