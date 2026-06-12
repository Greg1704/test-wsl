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
   * El resto de las cards queda neutro para que esta destaque.
   */
  variant?: "default" | "brand";
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

  return (
    <Card
      className={cn(
        "gap-2",
        brand &&
          "border-transparent bg-linear-to-br from-primary to-[oklch(0.47_0.11_166)] text-primary-foreground dark:to-[oklch(0.55_0.135_164)]"
      )}
    >
      <CardHeader className="flex items-center justify-between">
        <CardTitle
          className={cn(
            "text-sm font-medium",
            brand ? "text-primary-foreground/85" : "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "size-4",
            brand ? "text-primary-foreground/85" : "text-muted-foreground"
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
              brand ? "text-primary-foreground/75" : "text-muted-foreground"
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
