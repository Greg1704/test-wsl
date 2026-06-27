"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAmount, formatCompactAmount } from "@/lib/format";

/** Un mes de la serie: label + ahorro disponible proyectado (en moneda, no centavos). */
export type SavingsPoint = { month: string; balance: number };

/**
 * Línea del ahorro disponible proyectado a futuro: la trayectoria del STOCK (a
 * diferencia de la proyección de cuotas, que son barras apiladas por tarjeta). Client
 * Component (Recharts en el browser); recibe datos planos ya convertidos (number, nunca
 * BigInt) por la regla de rsc-y-payload.
 */
export function SavingsProjectionChart({
  currency,
  data,
}: {
  currency: string;
  data: SavingsPoint[];
}) {
  const config: ChartConfig = {
    balance: { label: "Ahorro disponible", color: "var(--chart-1)" },
  };

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <LineChart data={data} margin={{ top: 16, right: 8, left: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="capitalize"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(value: number) => formatCompactAmount(value, currency)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelClassName="capitalize"
              formatter={(value) => (
                <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                  <span className="text-muted-foreground">Ahorro disponible</span>
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    {formatAmount(Number(value), currency)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Line
          dataKey="balance"
          type="monotone"
          stroke="var(--color-balance)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
