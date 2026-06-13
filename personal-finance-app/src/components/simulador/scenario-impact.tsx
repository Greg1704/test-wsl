"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { SIM_CARD_ID, type SimulationImpact } from "@/server/lib/simulation";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjectionChart } from "@/components/dashboard/projection-chart";

const REAL_KEY = "real";

// Lo ya comprometido en gris neutro; esta compra en esmeralda de marca, apiladas.
const CHART_CARDS = [
  { id: REAL_KEY, name: "Comprometido", color: "var(--muted-foreground)" },
  { id: SIM_CARD_ID, name: "Esta compra", color: "var(--primary)" },
];

/** Resultado de un escenario (modo de un solo plan): chart apilado + detalle mensual. */
export function ScenarioImpact({
  impact,
  currency,
}: {
  impact: SimulationImpact;
  currency: string;
}) {
  const chartData = impact.months.map((m) => ({
    month: m.label,
    [REAL_KEY]: m.committedBefore,
    [SIM_CARD_ID]: m.thisPurchase,
  }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Impacto en tu flujo · {currency}</CardTitle>
          <CardDescription>
            Lo ya comprometido y esta compra (otro color, apilada arriba)
            {impact.income !== null && " — la línea punteada es tu ingreso"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectionChart
            currency={currency}
            income={impact.income}
            cards={CHART_CARDS}
            data={chartData}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle mes a mes</CardTitle>
          <CardDescription>
            Comprometido antes y después de esta compra
            {impact.income !== null
              ? ", con tu disponible neto resultante."
              : " (sin ingreso en esta moneda, no se calcula el neto)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Antes</TableHead>
                <TableHead className="text-right">Esta compra</TableHead>
                <TableHead className="text-right">Después</TableHead>
                <TableHead className="text-right">Disp. neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impact.months.map((m, i) => (
                <TableRow key={i} className={cn(m.thisPurchase > 0 && "bg-primary/5")}>
                  <TableCell className="font-medium capitalize">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(m.committedBefore, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.thisPurchase > 0 ? (
                      <span className="text-primary font-medium">
                        +{formatAmount(m.thisPurchase, currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(m.committedAfter, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.netAfter === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-medium",
                          m.netAfter < 0 ? "text-destructive" : "text-foreground"
                        )}
                      >
                        {m.netAfter < 0 ? (
                          <TrendingDown className="size-3.5" />
                        ) : (
                          <TrendingUp className="size-3.5" />
                        )}
                        {formatAmount(m.netAfter, currency)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
