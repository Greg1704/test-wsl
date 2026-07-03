"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setTrackCreditLimits } from "@/server/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Toggle del seguimiento de límite de crédito + utilización. Guarda al instante (sin
 * botón), con estado optimista que se revierte si la action falla. Con esto activo, el
 * alta de tarjeta muestra el campo de límite (opcional) y las compras en otra moneda que
 * la principal piden la cotización al confirmar.
 */
export function CreditLimitForm({
  initialEnabled,
  mainCurrency,
}: {
  initialEnabled: boolean;
  mainCurrency: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function onCheckedChange(next: boolean) {
    setEnabled(next); // optimista
    startTransition(async () => {
      try {
        await setTrackCreditLimits(next);
        toast.success(
          next
            ? "Activaste el seguimiento de límite de crédito."
            : "Desactivaste el seguimiento de límite de crédito."
        );
      } catch {
        setEnabled(!next); // revertir
        toast.error("No pudimos guardar la preferencia.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <Label htmlFor="track-credit-limits">Seguir el límite de crédito</Label>
        <p className="text-muted-foreground text-sm">
          Cargá el límite de cada tarjeta (en {mainCurrency}, tu moneda principal) y mirá
          cuánto está comprometido en cuotas. Las compras en otra moneda te van a pedir la
          cotización para sumarlas al límite.
        </p>
      </div>
      <Switch
        id="track-credit-limits"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
