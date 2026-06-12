"use client";

import { Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAmount, formatCompactAmount } from "@/lib/format";

export type CategorySlice = {
  /** Identificador estable para el config del chart ("none" si no hay categoría). */
  key: string;
  name: string;
  /** Monto del mes en moneda (no centavos), ya convertido en el server. */
  value: number;
  /** Hex de la categoría; null usa la paleta del tema como fallback. */
  color: string | null;
};

type CategoryDonutProps = {
  currency: string;
  slices: CategorySlice[];
};

/**
 * Donut de gasto del mes por categoría (RF-7.3). Client Component (Recharts);
 * recibe datos planos por la regla de rsc-y-payload. El color sale de la
 * categoría del usuario y, si no tiene, de la paleta del tema.
 */
export function CategoryDonut({ currency, slices }: CategoryDonutProps) {
  const config: ChartConfig = Object.fromEntries(
    slices.map((s, i) => [
      s.key,
      { label: s.name, color: s.color ?? `var(--chart-${(i % 5) + 1})` },
    ])
  );

  // Recharts toma el `fill` directo de cada dato; el total es solo para el centro.
  const data = slices.map((s, i) => ({
    ...s,
    fill: s.color ?? `var(--chart-${(i % 5) + 1})`,
  }));
  const total = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-72 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <>
                  <div
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.payload?.fill }}
                  />
                  <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                    <span className="text-muted-foreground">{item.payload?.name}</span>
                    <span className="text-foreground font-mono font-medium tabular-nums">
                      {formatAmount(Number(value), currency)}
                    </span>
                  </div>
                </>
              )}
            />
          }
        />
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={60} strokeWidth={4}>
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
              return (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    className="fill-foreground text-base font-semibold"
                  >
                    {formatCompactAmount(total, currency)}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 18}
                    className="fill-muted-foreground text-xs"
                  >
                    en el mes
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap" />
      </PieChart>
    </ChartContainer>
  );
}
