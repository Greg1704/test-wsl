import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KpiCardProps = {
  title: string;
  icon: LucideIcon;
  value: string;
  valueClassName?: string;
  /** Texto secundario bajo el valor (contexto del número). */
  hint?: string;
  /**
   * "brand": card protagonista en esmeralda (la métrica estrella del producto).
   * "danger": misma card pero en rojo (mismo nivel de claridad que el esmeralda),
   * para el disponible neto cuando entrás en deuda. El resto queda neutro.
   */
  variant?: "default" | "brand" | "danger";
  /** Contenido extra (ej. barra de progreso). */
  children?: React.ReactNode;
};

/**
 * Tarjeta de métrica del dashboard (valor grande + contexto). Server Component:
 * recibe todo ya formateado como string, no maneja BigInt ni estado.
 */
export function KpiCard({
  title,
  icon: Icon,
  value,
  valueClassName,
  hint,
  variant = "default",
  children,
}: KpiCardProps) {
  const brand = variant === "brand";
  const danger = variant === "danger";
  // Ambas variantes usan fondo de color con texto claro; solo cambia el tono.
  const accent = brand || danger;

  return (
    <Card
      className={cn(
        "gap-2",
        brand &&
          "border-transparent bg-linear-to-br from-primary to-[oklch(0.47_0.11_166)] text-primary-foreground dark:to-[oklch(0.55_0.135_164)]",
        // Rojo con la misma claridad que el esmeralda (mismos L que el gradiente brand).
        danger &&
          "border-transparent bg-linear-to-br from-[oklch(0.596_0.2_25)] to-[oklch(0.47_0.16_27)] text-primary-foreground dark:from-[oklch(0.696_0.2_25)] dark:to-[oklch(0.55_0.17_25)]"
      )}
    >
      <CardHeader className="flex items-center justify-between">
        <CardTitle
          className={cn(
            "text-sm font-medium",
            accent ? "text-primary-foreground/85" : "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "size-4",
            accent ? "text-primary-foreground/85" : "text-muted-foreground"
          )}
        />
      </CardHeader>
      <CardContent className="grid gap-1.5">
        <p className={cn("text-2xl font-semibold tracking-tight", valueClassName)}>
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "text-xs",
              accent ? "text-primary-foreground/75" : "text-muted-foreground"
            )}
          >
            {hint}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
