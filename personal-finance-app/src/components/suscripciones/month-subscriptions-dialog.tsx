"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setChargeState } from "@/server/actions/subscriptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Cobro de suscripción del mes ya serializado para el cliente (regla rsc-y-payload): monto
 * formateado, sin BigInt. `status` es PENDING o PAID (los salteados no se listan).
 */
export type MonthSubscriptionView = {
  subscriptionId: string;
  name: string;
  cardName: string | null;
  amount: string;
  status: "PENDING" | "PAID";
};

type Act = (
  subscriptionId: string,
  action: "PAID" | "RESET",
  paidFromSavings: boolean,
  okMsg: string
) => void;

/**
 * Modal del dashboard para marcar/revertir las suscripciones que se cobran en el mes mostrado,
 * sin salir del resumen (espejo del de "Gestionar cuotas"). `periodMonth` es el ISO del primer
 * día del mes navegado; al marcar, el Server Action revalida y `router.refresh()` actualiza las
 * filas en vivo sin cerrar el modal.
 */
export function MonthSubscriptionsDialog({
  monthLabel,
  periodMonth,
  subscriptions,
}: {
  monthLabel: string;
  periodMonth: string;
  subscriptions: MonthSubscriptionView[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const act: Act = (subscriptionId, action, paidFromSavings, okMsg) => {
    startTransition(async () => {
      try {
        await setChargeState({
          subscriptionId,
          periodMonth: new Date(periodMonth),
          action,
          paidFromSavings,
        });
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No pudimos actualizar el cobro.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Gestionar suscripciones
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">Suscripciones de {monthLabel}</DialogTitle>
          <DialogDescription>
            Marcá las suscripciones que ya pagaste. Por defecto se descuentan de tu ahorro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {subscriptions.map((s) => (
            <MonthSubscriptionRow
              key={s.subscriptionId}
              sub={s}
              isPending={isPending}
              onAct={act}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MonthSubscriptionRow({
  sub,
  isPending,
  onAct,
}: {
  sub: MonthSubscriptionView;
  isPending: boolean;
  onAct: Act;
}) {
  const isPaid = sub.status === "PAID";
  const [fromSavings, setFromSavings] = useState(true);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm">
      <div className="grid min-w-0">
        <span className="truncate font-medium">{sub.name}</span>
        {sub.cardName && (
          <span className="text-muted-foreground text-xs">{sub.cardName}</span>
        )}
      </div>
      <Badge variant={isPaid ? "outline" : "secondary"} className="ml-auto">
        {isPaid ? "Pagada" : "Pendiente"}
      </Badge>
      <span className="font-medium whitespace-nowrap">{sub.amount}</span>
      {isPaid ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => onAct(sub.subscriptionId, "RESET", true, "Cobro revertido")}
        >
          Revertir
        </Button>
      ) : (
        <div className="flex items-center gap-2">
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
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onAct(sub.subscriptionId, "PAID", fromSavings, "Cobro marcado como pagado")}
          >
            Marcar paga
          </Button>
        </div>
      )}
    </div>
  );
}
