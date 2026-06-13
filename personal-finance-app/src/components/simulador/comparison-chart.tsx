"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAmount, formatCompactAmount } from "@/lib/format";
import type { ComparisonPoint } from "@/server/lib/scenario-compare";

type ComparisonChartProps = {
  currency: string;
  /** Ingreso mensual (en moneda) para la línea de referencia. */
  income: number | null;
  aName: string;
  bName: string;
  data: ComparisonPoint[];
};

/**
 * Overlay de líneas: el comprometido total (real + esta compra) por mes de cada
 * escenario, para comparar cómo cada plan carga el flujo futuro. Solo se usa cuando
 * A y B comparten moneda (RF-9.1). Client Component (Recharts renderiza en el browser).
 */
export function ComparisonChart({
  currency,
  income,
  aName,
  bName,
  data,
}: ComparisonChartProps) {
  const config: ChartConfig = {
    a: { label: aName, color: "var(--chart-1)" },
    b: { label: bName, color: "var(--chart-3)" },
  };

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <LineChart data={data} margin={{ top: 16, right: 8, left: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
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
              formatter={(value, name, item) => (
                <>
                  <div
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? name}
                    </span>
                    <span className="text-foreground font-mono font-medium tabular-nums">
                      {formatAmount(Number(value), currency)}
                    </span>
                  </div>
                </>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="a"
          type="monotone"
          stroke="var(--color-a)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="b"
          type="monotone"
          stroke="var(--color-b)"
          strokeWidth={2}
          dot={false}
        />
        {income !== null && income > 0 && (
          <ReferenceLine
            y={income}
            ifOverflow="extendDomain"
            stroke="var(--foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: "Ingreso",
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
        )}
      </LineChart>
    </ChartContainer>
  );
}
