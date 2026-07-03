"use client";

import { AlertTriangle } from "lucide-react";

import type { UtilizationProjection, UtilizationLevel } from "@/server/lib/card-utilization";
import { formatMoney } from "@/server/lib/money";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Color de la barra según el nivel (mismo criterio que la barra real de Tarjetas). */
const BAR_CLASS: Record<UtilizationLevel, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  over: "bg-destructive",
};

/**
 * Proyección de utilización del límite para un plan del simulador: la barra "antes →
 * después" de concretar la compra. Si la compra es en otra moneda que el límite y todavía
 * no se ingresó la cotización, invita a cargarla (el input vive en el form del plan).
 */
export function ScenarioUtilization({
  projection,
  needsRate,
  currency,
}: {
  projection: UtilizationProjection | null;
  needsRate: boolean;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Utilización del límite · {currency}</CardTitle>
        <CardDescription>Cómo queda el límite de la tarjeta si hacés esta compra.</CardDescription>
      </CardHeader>
      <CardContent>
        {!projection ? (
          <p className="text-muted-foreground text-sm">
            {needsRate
              ? "Ingresá la cotización en el plan para proyectar la utilización del límite."
              : "Elegí una tarjeta y un monto para ver el impacto en el límite."}
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                {projection.beforePercent.toLocaleString("es-AR")}% →{" "}
                <span
                  className={cn(
                    "text-foreground font-semibold",
                    projection.afterLevel === "over" && "text-destructive",
                    projection.afterLevel === "warning" && "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {projection.afterPercent.toLocaleString("es-AR")}%
                </span>{" "}
                del límite
              </span>
              <span className="text-muted-foreground">
                +{formatMoney(projection.addedCents, currency)}
              </span>
            </div>

            {/* Barra: relleno actual en gris + lo que suma esta compra en color de nivel. */}
            <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
              <div
                className="bg-muted-foreground/40 absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.min(projection.beforePercent, 100)}%` }}
              />
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", BAR_CLASS[projection.afterLevel])}
                style={{ width: `${Math.min(projection.afterPercent, 100)}%`, opacity: 0.85 }}
              />
            </div>

            <p className="text-muted-foreground text-sm">
              Usarías {formatMoney(projection.afterUsedCents, currency)} de{" "}
              {formatMoney(projection.limitCents, currency)}.
            </p>

            {projection.afterLevel !== "ok" && (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  projection.afterLevel === "over" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                )}
              >
                <AlertTriangle className="size-4 shrink-0" />
                {projection.afterLevel === "over"
                  ? "Con esta compra te pasarías del límite."
                  : "Con esta compra quedarías cerca del límite."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
