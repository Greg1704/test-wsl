"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setMonthlyReportEnabled } from "@/server/actions/settings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Toggle del opt-in al mail mensual de deudas. Guarda al instante al cambiar (sin
 * botón): estado optimista que se revierte si la action falla.
 */
export function NotificationsForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function onCheckedChange(next: boolean) {
    setEnabled(next); // optimista
    startTransition(async () => {
      try {
        await setMonthlyReportEnabled(next);
        toast.success(
          next ? "Vas a recibir el reporte mensual." : "Desactivaste el reporte mensual."
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
        <Label htmlFor="monthly-report">Reporte mensual por mail</Label>
        <p className="text-muted-foreground text-sm">
          El día 1 de cada mes te enviamos un resumen de las cuotas que vencen y tu
          disponible neto, por moneda.
        </p>
      </div>
      <Switch
        id="monthly-report"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
