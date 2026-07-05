"use client";

import { useState } from "react";
import { Archive } from "lucide-react";

import type { SubscriptionView } from "@/server/actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteSubscriptionButton } from "@/components/suscripciones/delete-subscription-button";
import { ReactivateSubscriptionButton } from "@/components/suscripciones/reactivate-subscription-button";

/**
 * Modal de suscripciones CERRADAS: dadas de baja y con la fecha de baja ya pasada, así que no
 * generan cobros nuevos. Se sacan de la lista principal y se conservan acá como historial
 * (mismo patrón que "Tarjetas desactivadas"). Se pueden eliminar solo las que no tengan cobros
 * pagados (guard duro).
 */
export function ArchivedSubscriptionsDialog({
  subscriptions,
}: {
  subscriptions: SubscriptionView[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Archive className="size-4" />
          Cerradas ({subscriptions.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Suscripciones cerradas</DialogTitle>
          <DialogDescription>
            Archivadas: fuera de la lista y sin generar cobros, pero sus pagos siguen contando
            en el historial. Reactivalas para retomarlas, o eliminá las que no tengan pagos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {subscriptions.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-2.5 text-sm"
            >
              <div className="grid gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  {s.name}
                  <Badge variant={s.paymentMethod === "CREDIT" ? "secondary" : "outline"}>
                    {s.paymentMethod === "CREDIT" ? "Crédito" : "Débito"}
                  </Badge>
                </span>
                <span className="text-muted-foreground text-xs">
                  {s.amount} · {s.currency}/mes · desde {s.firstChargeLabel}
                  {s.endLabel && ` · baja ${s.endLabel}`}
                </span>
              </div>
              <div className="ml-auto flex gap-1">
                <ReactivateSubscriptionButton id={s.id} />
                {!s.hasPaidCharges && <DeleteSubscriptionButton id={s.id} />}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
