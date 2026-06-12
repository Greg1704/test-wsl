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
  children,
}: KpiCardProps) {
  return (
    <Card className="gap-2">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="grid gap-1.5">
        <p className={cn("text-2xl font-semibold tracking-tight", valueClassName)}>
          {value}
        </p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        {children}
      </CardContent>
    </Card>
  );
}
