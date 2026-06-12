"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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

/** Un mes de la serie: label + total + un monto por tarjeta (key = cardId). */
export type ProjectionPoint = { month: string } & Record<string, number | string>;

type ProjectionChartProps = {
  currency: string;
  /** Ingreso mensual (en moneda, no centavos) para la línea de referencia. */
  income: number | null;
  /** Tarjetas de la serie, en el orden de apilado (la de mayor total abajo). */
  cards: { id: string; name: string }[];
  data: ProjectionPoint[];
};

/**
 * Barras apiladas por tarjeta de las cuotas comprometidas en los próximos meses,
 * con el ingreso como línea de referencia: el corazón visual del producto
 * ("¿cuánto de mi ingreso ya está comprometido, y hasta cuándo?"). Es Client
 * Component porque Recharts renderiza en el browser; recibe solo datos planos
 * ya convertidos (number/string, nunca BigInt) por la regla de rsc-y-payload.
 */
export function ProjectionChart({ currency, income, cards, data }: ProjectionChartProps) {
  // Cada tarjeta toma un color de la paleta del tema (--chart-1..5, cicla si hay más).
  const config: ChartConfig = Object.fromEntries(
    cards.map((c, i) => [c.id, { label: c.name, color: `var(--chart-${(i % 5) + 1})` }])
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ top: 16, right: 8, left: 8 }}>
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
        {cards.map((c, i) => (
          <Bar
            key={c.id}
            dataKey={c.id}
            stackId="committed"
            fill={`var(--color-${c.id})`}
            // Solo el segmento de arriba de la pila lleva el borde redondeado.
            radius={i === cards.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
        {income !== null && income > 0 && (
          <ReferenceLine
            y={income}
            // Si el ingreso supera el máximo de las barras, extender el eje Y para
            // que la línea igual se vea (por defecto Recharts la descarta).
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
      </BarChart>
    </ChartContainer>
  );
}
