"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
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
  /**
   * Series a apilar, en orden (la de abajo primero). `color` opcional sobreescribe
   * el color de la paleta (`--chart-N`); lo usa el simulador para diferenciar lo
   * real (gris) de la compra simulada (esmeralda).
   */
  cards: { id: string; name: string; color?: string }[];
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
    cards.map((c, i) => [
      c.id,
      { label: c.name, color: c.color ?? `var(--chart-${(i % 5) + 1})` },
    ])
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
        {cards.map((c) => (
          <Bar
            key={c.id}
            dataKey={c.id}
            stackId="committed"
            fill={`var(--color-${c.id})`}
            // Redondeo consistente mes a mes: el borde superior lo lleva el segmento
            // más alto que NO sea cero de cada pila (no siempre la última serie). Así
            // todos los meses tienen el mismo tope redondeado, tengan o no la serie de
            // arriba — antes, si esa serie valía 0, el mes mostraba un tope cuadrado.
            shape={(props) => {
              const values = (props.payload ?? {}) as Record<string, number>;
              const topId = [...cards]
                .reverse()
                .find((cc) => Number(values[cc.id] ?? 0) > 0)?.id;
              return (
                <Rectangle
                  {...props}
                  radius={c.id === topId ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              );
            }}
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
