import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Layers,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";

import { requireUser } from "@/server/auth/session";
import {
  getCategoryBreakdown,
  getDebtStats,
  getMonthlyOverview,
  getNonCreditBreakdown,
  getOnboardingStatus,
  getProjection,
  getSavingsOverview,
  getSavingsProjection,
  listInstallmentsByMonth,
} from "@/server/actions/dashboard";
import { computeDisplayStatus } from "@/server/lib/installment-status";
import { getCardsUtilization } from "@/server/actions/cards";
import { completedSteps } from "@/server/lib/onboarding";
import { WARNING_THRESHOLD } from "@/server/lib/card-utilization";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthInstallmentsDialog } from "@/components/compras/month-installments-dialog";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { NextStepBanner } from "@/components/dashboard/next-step-banner";
import { CardLimitsAlert } from "@/components/dashboard/card-limits-alert";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProjectionChart } from "@/components/dashboard/projection-chart";
import { SavingsProjectionChart } from "@/components/dashboard/savings-projection-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";

const PROJECTION_MONTHS = 12;

type SearchParams = { month?: string; cur?: string };

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
  const [
    overview,
    installments,
    projection,
    breakdown,
    debtStats,
    savings,
    savingsProjection,
    nonCreditBreakdown,
    cardsUtilization,
  ] = await Promise.all([
    getMonthlyOverview(month),
    listInstallmentsByMonth(month),
    getProjection(month, PROJECTION_MONTHS),
    getCategoryBreakdown(month),
    getDebtStats(),
    getSavingsOverview(month),
    getSavingsProjection(month, PROJECTION_MONTHS),
    getNonCreditBreakdown(month),
    getCardsUtilization(),
  ]);

  // Tarjetas cerca (o por encima) de su límite: solo la señal, la barra vive en /tarjetas.
  const cardLimitAlerts = cardsUtilization
    .filter((u) => u.percent >= WARNING_THRESHOLD)
    .map((u) => ({ cardId: u.cardId, name: u.name, currency: u.currency, percent: u.percent }));

  const { defaultCurrency } = overview;

  // Monedas con datos (cuotas o ahorro): definen el toggle. La principal va primero.
  const availableCurrencies = Array.from(
    new Set([
      ...overview.currencies.map((c) => c.currency),
      ...savings.currencies.map((s) => s.currency),
    ])
  ).sort((a, b) => (a === defaultCurrency ? -1 : b === defaultCurrency ? 1 : 0));

  // Moneda seleccionada (facet por URL); fallback a la principal.
  const currency =
    sp.cur && availableCurrencies.includes(sp.cur) ? sp.cur : defaultCurrency;

  // Datos de la moneda seleccionada, con fallback (una moneda puede tener ahorro pero
  // no cuotas, o viceversa).
  const main =
    overview.currencies.find((c) => c.currency === currency) ??
    ({ currency, committedCents: 0n, nextDue: null, incomeCents: null, netCents: null } as
      (typeof overview.currencies)[number]);
  const sav =
    savings.currencies.find((s) => s.currency === currency) ??
    ({ currency, beforeCents: 0n, afterCents: 0n, currentRealCents: 0n } as
      (typeof savings.currencies)[number]);
  const debt = debtStats.find((d) => d.currency === currency);
  const committedPercent = percentOfIncome(main.committedCents, main.incomeCents);

  // DTOs planos para los charts (Client Components): nada de BigInt ni Date.
  const projSerie = projection.find((p) => p.currency === currency);
  const projectionData = projSerie
    ? projSerie.months.map((m) => ({
        month: formatDate(m.month, "MMM yy"),
        ...Object.fromEntries(
          projSerie.cards.map((c) => [c.id, centsToCurrency(m.byCard[c.id] ?? 0n)])
        ),
      }))
    : [];
  const projectionIncome = main.incomeCents !== null ? centsToCurrency(main.incomeCents) : null;

  const creditDonut = breakdown.find((b) => b.currency === currency);
  const creditSlices = (creditDonut?.slices ?? []).map((s) => ({
    key: s.id ?? "none",
    name: s.name,
    value: centsToCurrency(s.amountCents),
    color: s.color,
  }));

  const savProjSerie = savingsProjection.find((s) => s.currency === currency);
  const savingsData = (savProjSerie?.months ?? []).map((m) => ({
    month: formatDate(m.month, "MMM yy"),
    balance: centsToCurrency(m.beforeCents),
  }));

  const nonCreditDonut = nonCreditBreakdown.find((b) => b.currency === currency);
  const nonCreditSlices = (nonCreditDonut?.slices ?? []).map((s) => ({
    key: s.id ?? "none",
    name: s.name,
    value: centsToCurrency(s.amountCents),
    color: s.color,
  }));

  // DTO mínimo y serializable para el modal de gestión de cuotas del mes.
  const installmentViews = installments.map((i) => ({
    id: i.id,
    description: i.purchase.description,
    // Las cuotas solo existen para crédito ⇒ siempre hay tarjeta.
    cardName: i.purchase.card!.name,
    cardLast4: i.purchase.card!.last4,
    installmentNumber: i.installmentNumber,
    totalInstallments: i.purchase.totalInstallments,
    dueDate: formatDate(i.dueDate),
    amount: formatMoney(i.amountCents, i.currency),
    status: computeDisplayStatus(i.status, i.dueDate),
  }));

  const monthLabel = formatMonthYear(month);
  // Hrefs que preservan moneda + mes al navegar/cambiar de facet.
  const navHref = (m: string, c: string = currency) => `/dashboard?month=${m}&cur=${c}`;
  const prevMonth = formatMonthParam(addMonths(month, -1));
  const nextMonth = formatMonthParam(addMonths(month, 1));
  const monthParam = formatMonthParam(month);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {userName || "👋"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Tu resumen del mes: cuotas y ahorro.
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

      {/* Barra de control: navegación de mes (RF-5.3), toggle de moneda y gestión de
          cuotas del mes mostrado. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={navHref(prevMonth)} aria-label="Mes anterior">
              <ChevronLeft />
            </Link>
          </Button>
          <span className="text-sm font-medium capitalize">{monthLabel}</span>
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={navHref(nextMonth)} aria-label="Mes siguiente">
              <ChevronRight />
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle de moneda: solo si el usuario opera en más de una (RF-9.1). */}
          {availableCurrencies.length > 1 && (
            <div className="flex items-center rounded-md border p-0.5">
              {availableCurrencies.map((c) => (
                <Button
                  key={c}
                  asChild
                  variant={c === currency ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5"
                >
                  <Link href={navHref(monthParam, c)}>{c}</Link>
                </Button>
              ))}
            </div>
          )}
          {installmentViews.length > 0 && (
            <MonthInstallmentsDialog
              monthLabel={monthLabel}
              installments={installmentViews}
            />
          )}
        </div>
      </div>

      {/* Banner generalizado: empuja al único paso de alta que falte. */}
      <NextStepBanner flags={onboarding} />

      {/* Alerta de tarjetas cerca del límite de crédito (utilización alta). */}
      <CardLimitsAlert cards={cardLimitAlerts} />

      {/* HÉROE: las cuatro cifras titulares de los dos ejes, en la moneda seleccionada. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* La métrica estrella del producto va en la card de marca (esmeralda). */}
        <KpiCard
          title="Disponible neto"
          icon={Wallet}
          variant={main.netCents !== null && main.netCents < 0n ? "danger" : "brand"}
          value={main.netCents !== null ? formatMoney(main.netCents, currency) : "—"}
          hint={
            main.incomeCents !== null && main.incomeCents > 0n
              ? `Ingreso ${formatMoney(main.incomeCents, currency)} − cuotas del mes`
              : "Configurá tu ingreso para calcularlo"
          }
        />
        <KpiCard
          title="Cuotas del mes"
          icon={Receipt}
          value={formatMoney(main.committedCents, currency)}
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
          title="Ahorro disponible"
          icon={PiggyBank}
          value={formatMoney(sav.beforeCents, currency)}
          hint="Saldo guardado este mes, antes de las cuotas"
        />
        <KpiCard
          title="Ahorro tras cuotas"
          icon={PiggyBank}
          variant={sav.afterCents < 0n ? "danger" : undefined}
          value={formatMoney(sav.afterCents, currency)}
          hint={
            main.committedCents > 0n
              ? `Si pagás las cuotas del mes desde tu ahorro`
              : "Sin cuotas este mes"
          }
        />
      </section>

      {/* Profundidad por eje (RF-9.1: cada vista en la moneda seleccionada). */}
      <Tabs defaultValue="resumen" className="gap-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="credito">Crédito</TabsTrigger>
          <TabsTrigger value="ahorro">Ahorro</TabsTrigger>
        </TabsList>

        {/* RESUMEN: lo transversal — próximos vencimientos y otras monedas. */}
        <TabsContent value="resumen" className="flex flex-col gap-6">
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
                          {formatMoney(c.nextDue.amountCents, c.currency)} · {c.currency}
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

          {/* Otras monedas: resumen compacto (cuotas + ahorro), nunca sumado. */}
          {availableCurrencies
            .filter((c) => c !== currency)
            .map((c) => {
              const o = overview.currencies.find((x) => x.currency === c);
              const s = savings.currencies.find((x) => x.currency === c);
              return (
                <section
                  key={c}
                  className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm"
                >
                  <span className="text-foreground font-semibold">{c}</span>
                  {o && (
                    <span>
                      Cuotas del mes:{" "}
                      <span className="text-foreground font-medium">
                        {formatMoney(o.committedCents, c)}
                      </span>
                    </span>
                  )}
                  {s && (
                    <span>
                      Ahorro disponible:{" "}
                      <span className="text-foreground font-medium">
                        {formatMoney(s.beforeCents, c)}
                      </span>
                    </span>
                  )}
                  <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0">
                    <Link href={navHref(monthParam, c)}>Ver {c}</Link>
                  </Button>
                </section>
              );
            })}
        </TabsContent>

        {/* CRÉDITO: proyección de cuotas, deuda y gasto por categoría. */}
        <TabsContent value="credito" className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              title="Deuda restante"
              icon={Layers}
              value={formatMoney(debt?.remainingCents ?? 0n, currency)}
              hint={
                debt
                  ? `${debt.pendingCount} ${
                      debt.pendingCount === 1 ? "cuota pendiente" : "cuotas pendientes"
                    } a hoy`
                  : "Sin cuotas pendientes"
              }
            />
            <KpiCard
              title="Libre de cuotas"
              icon={CalendarCheck2}
              value={debt?.lastDueDate ? formatDate(debt.lastDueDate, "MMM yyyy") : "Hoy"}
              valueClassName="capitalize"
              hint={
                debt?.lastDueDate
                  ? "Cuando vence tu última cuota pendiente"
                  : "No debés ninguna cuota"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Proyección a {PROJECTION_MONTHS} meses · {currency}
              </CardTitle>
              <CardDescription>
                Cuotas comprometidas por tarjeta desde{" "}
                <span className="capitalize">{monthLabel}</span>
                {projectionIncome !== null && " — la línea punteada es tu ingreso"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectionData.length > 0 && projSerie ? (
                <ProjectionChart
                  currency={currency}
                  income={projectionIncome}
                  cards={projSerie.cards}
                  data={projectionData}
                />
              ) : (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  No hay cuotas comprometidas en {currency} desde{" "}
                  <span className="capitalize">{monthLabel}</span>.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gasto por categoría</CardTitle>
              <CardDescription className="capitalize">
                Cuotas que vencen en {monthLabel}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {creditSlices.length > 0 ? (
                <CategoryDonut currency={currency} slices={creditSlices} />
              ) : (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  No hay cuotas que venzan este mes en {currency}.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AHORRO: trayectoria del stock y gasto no-crédito del mes. */}
        <TabsContent value="ahorro" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Proyección del ahorro · {currency}
              </CardTitle>
              <CardDescription>
                Saldo disponible estimado mes a mes (ingreso − gastos), desde{" "}
                <span className="capitalize">{monthLabel}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SavingsProjectionChart currency={currency} data={savingsData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gasto no-crédito por categoría</CardTitle>
              <CardDescription className="capitalize">
                Débito, transferencia y efectivo de {monthLabel}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nonCreditSlices.length > 0 ? (
                <CategoryDonut currency={currency} slices={nonCreditSlices} />
              ) : (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  No registraste gastos de débito, transferencia o efectivo en {currency}{" "}
                  este mes.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
