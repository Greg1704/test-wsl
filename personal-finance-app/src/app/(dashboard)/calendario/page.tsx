import Link from "next/link";

import { requireUser } from "@/server/auth/session";
import { listInstallmentsByMonth } from "@/server/actions/dashboard";
import { groupInstallmentsByDate } from "@/server/lib/dashboard";
import { computeDisplayStatus } from "@/server/lib/installment-status";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendario de cuotas</h1>
        <p className="text-muted-foreground text-sm">
          Vencimientos del mes, agrupados por fecha.
        </p>
      </header>

      <div className="flex items-center justify-between rounded-lg border px-2 py-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/calendario?month=${prevMonth}`} aria-label="Mes anterior">
            ‹
          </Link>
        </Button>
        <span className="text-sm font-medium capitalize">{formatMonthYear(month)}</span>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/calendario?month=${nextMonth}`} aria-label="Mes siguiente">
            ›
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground text-sm">
          No hay cuotas que venzan este mes.
        </div>
      ) : (
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.date.toISOString()} className="grid gap-2">
              <h2 className="text-sm font-medium capitalize">
                {formatDate(group.date, "EEEE d")}
              </h2>
              <div className="grid gap-2">
                {group.items.map((inst) => {
                  const status = STATUS[computeDisplayStatus(inst.status, inst.dueDate)];
                  return (
                    <Link
                      key={inst.id}
                      href={`/compras/${inst.purchase.id}`}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="font-medium">{inst.purchase.description}</span>
                      <span className="text-muted-foreground">
                        {inst.purchase.card.name} ···· {inst.purchase.card.last4} ·{" "}
                        {inst.installmentNumber}/{inst.purchase.totalInstallments}
                      </span>
                      <span className="ml-auto font-medium">
                        {formatMoney(inst.amountCents, inst.currency)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
