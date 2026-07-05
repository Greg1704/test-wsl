"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setChargeState } from "@/server/actions/subscriptions";
import type { ScheduledChargeView } from "@/server/actions/subscriptions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  subscriptionId: string;
  upcoming: ScheduledChargeView[];
};

const STATUS_BADGE: Record<
  ScheduledChargeView["status"],
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  PAID: { label: "Pagada", variant: "outline" },
  SKIPPED: { label: "Salteada", variant: "destructive" },
};

type Act = (
  periodMonth: string,
  action: "PAID" | "SKIPPED" | "RESET",
  okMessage: string,
  paidFromSavings?: boolean
) => void;

/**
 * Próximos cobros de una suscripción con toggles de pago/salteo por mes. Al pagar, un checkbox
 * "De ahorros" decide si ese cobro sale del ahorro (aplica a crédito y débito). Cada acción
 * llama a `setChargeState` (que revalida la ruta), así que la UI se actualiza sola.
 */
export function SubscriptionSchedule({ subscriptionId, upcoming }: Props) {
  const [isPending, startTransition] = useTransition();

  const act: Act = (periodMonth, action, okMessage, paidFromSavings = true) => {
    startTransition(async () => {
      try {
        await setChargeState({
          subscriptionId,
          periodMonth: new Date(periodMonth),
          action,
          paidFromSavings,
        });
        toast.success(okMessage);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No pudimos actualizar el cobro.");
      }
    });
  };

  if (upcoming.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Sin próximos cobros (dada de baja).</p>
    );
  }

  return (
    <ul className="grid gap-1.5">
      {upcoming.map((c) => (
        <ScheduleRow key={c.periodMonth} charge={c} isPending={isPending} onAct={act} />
      ))}
    </ul>
  );
}

function ScheduleRow({
  charge,
  isPending,
  onAct,
}: {
  charge: ScheduledChargeView;
  isPending: boolean;
  onAct: Act;
}) {
  const badge = STATUS_BADGE[charge.status];
  const [fromSavings, setFromSavings] = useState(true);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm">
      {/* Solo la info se atenúa cuando está salteado; badge y botones quedan clickeables. */}
      <div
        className={cn(
          "flex flex-1 flex-wrap items-center gap-x-3 gap-y-1",
          charge.status === "SKIPPED" && "opacity-60"
        )}
      >
        <span className="w-28 shrink-0 font-medium capitalize">{charge.periodLabel}</span>
        <span className="text-muted-foreground text-xs">Vence {charge.dueDate}</span>
        <span className="font-medium">{charge.amount}</span>
      </div>
      <Badge variant={badge.variant}>{badge.label}</Badge>
      <div className="flex items-center gap-2">
        {charge.status === "PENDING" ? (
          <>
            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-primary size-3.5"
                checked={fromSavings}
                onChange={(e) => setFromSavings(e.target.checked)}
              />
              De ahorros
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                onAct(charge.periodMonth, "PAID", "Cobro marcado como pagado", fromSavings)
              }
            >
              Pagar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => onAct(charge.periodMonth, "SKIPPED", "Cobro salteado")}
            >
              Saltear
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => onAct(charge.periodMonth, "RESET", "Cobro restablecido")}
          >
            Deshacer
          </Button>
        )}
      </div>
    </li>
  );
}
