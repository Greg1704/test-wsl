import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/server/auth/session";
import { listInstallmentsByMonth } from "@/server/actions/dashboard";
import { groupInstallmentsByDate } from "@/server/lib/dashboard";
import { computeDisplayStatus } from "@/server/lib/installment-status";
import { formatMoney } from "@/server/lib/money";
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

const STATUS: Record<
  string,
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  PAID: { label: "Pagada", variant: "outline" },
  OVERDUE: { label: "Vencida", variant: "destructive" },
};

type SearchParams = { month?: string };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  await requireUser();

  // Mes navegable ±12 (RF-6.3); por defecto el mes actual.
  const month = monthParamToDate(sp.month) ?? new Date();
  const installments = await listInstallmentsByMonth(month);
  const groups = groupInstallmentsByDate(installments);

  const prevMonth = formatMonthParam(addMonths(month, -1));
  const nextMonth = formatMonthParam(addMonths(month, 1));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendario de cuotas</h1>
        <p className="text-muted-foreground text-sm">
          Vencimientos del mes, agrupados por fecha.
        </p>
      </header>

      <div className="flex items-center justify-between rounded-lg border px-2 py-1.5">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/calendario?month=${prevMonth}`} aria-label="Mes anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <span className="text-sm font-medium capitalize">{formatMonthYear(month)}</span>
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/calendario?month=${nextMonth}`} aria-label="Mes siguiente">
            <ChevronRight />
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <CalendarDays className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            No hay cuotas que venzan este mes.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => {
            const isToday = daysFromToday(group.date) === 0;

            // Total del día por moneda (RF-9.1: nunca se suman entre sí).
            const totals = new Map<string, bigint>();
            for (const inst of group.items) {
              totals.set(
                inst.currency,
                (totals.get(inst.currency) ?? 0n) + inst.amountCents
              );
            }
            const totalLabel = Array.from(totals.entries())
              .map(([currency, cents]) => formatMoney(cents, currency))
              .join(" · ");

            return (
              <section key={group.date.toISOString()} className="flex gap-3">
                {/* Chip de fecha: día grande + día de semana; hoy va resaltado. */}
                <div
                  className={cn(
                    "flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-lg border",
                    isToday
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40"
                  )}
                >
                  <span className="text-lg leading-none font-semibold">
                    {group.date.getDate()}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase",
                      isToday ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}
                  >
                    {formatDate(group.date, "EEE")}
                  </span>
                </div>

                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-medium capitalize">
                      {formatDate(group.date, "EEEE d")}
                      {isToday && (
                        <span className="text-primary ml-2 text-xs font-semibold">
                          Hoy
                        </span>
                      )}
                    </h2>
                    <span className="text-muted-foreground text-xs font-medium">
                      {totalLabel}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {group.items.map((inst) => {
                      const status =
                        STATUS[computeDisplayStatus(inst.status, inst.dueDate)];
                      return (
                        <Link
                          key={inst.id}
                          href={`/compras/${inst.purchase.id}`}
                          className="hover:bg-muted/50 flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors"
                        >
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <span className="truncate font-medium">
                            {inst.purchase.description}
                          </span>
                          <span className="text-muted-foreground hidden truncate sm:inline">
                            {inst.purchase.card.name} ···· {inst.purchase.card.last4} ·{" "}
                            {inst.installmentNumber}/{inst.purchase.totalInstallments}
                          </span>
                          <span className="ml-auto shrink-0 font-medium">
                            {formatMoney(inst.amountCents, inst.currency)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
