"use client";

import { useMemo, type ReactNode } from "react";

import {
  buildComparisonSeries,
  buildScenarioMetrics,
  type ScenarioMetrics,
} from "@/server/lib/scenario-compare";
import { formatMoney } from "@/server/lib/money";
import { formatDate } from "@/server/lib/dates";
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
import { ComparisonChart } from "./comparison-chart";
import type { Scenario } from "./use-scenario";

type ComparisonViewProps = {
  a: Scenario;
  b: Scenario;
  /** Ingreso de la moneda principal (para el % del ingreso y la línea del chart). */
  income: number | null;
  defaultCurrency: string;
  /** Comprometido real por mes de la moneda compartida; null si A y B difieren. */
  sharedBaselineCommitted: number[] | null;
};

const ROWS: { label: string; render: (m: ScenarioMetrics, currency: string) => ReactNode }[] = [
  { label: "Cuotas", render: (m) => m.installments },
  { label: "Cuota mensual", render: (m, cur) => formatMoney(m.firstInstallmentCents, cur) },
  { label: "Total a pagar", render: (m, cur) => formatMoney(m.totalCents, cur) },
  { label: "Recargo", render: (m) => (m.surchargePct > 0 ? `+${m.surchargePct.toFixed(1)}%` : "—") },
  { label: "TEM", render: (m) => (m.tem > 0 ? `${m.tem.toFixed(1)}%/mes` : "—") },
  {
    label: "Te liberás",
    render: (m) => <span className="capitalize">{formatDate(m.lastDueDate, "MMM yyyy")}</span>,
  },
  {
    label: "Pico cuotas / ingreso",
    render: (m) =>
      m.peakPercentOfIncome !== null
        ? `${m.peakPercentOfIncome.toLocaleString("es-AR")}%`
        : "—",
  },
];

export function ComparisonView({
  a,
  b,
  income,
  defaultCurrency,
  sharedBaselineCommitted,
}: ComparisonViewProps) {
  // Garantizado por el padre: solo se renderiza con ambos planes/impactos listos.
  const planA = a.plan!;
  const planB = b.plan!;
  const impactA = a.impact!;
  const impactB = b.impact!;
  const sameCurrency = a.currency === b.currency;

  const metricsA = useMemo(
    () =>
      buildScenarioMetrics({
        plan: planA,
        impact: impactA,
        income: a.currency === defaultCurrency ? income : null,
      }),
    [planA, impactA, a.currency, defaultCurrency, income]
  );
  const metricsB = useMemo(
    () =>
      buildScenarioMetrics({
        plan: planB,
        impact: impactB,
        income: b.currency === defaultCurrency ? income : null,
      }),
    [planB, impactB, b.currency, defaultCurrency, income]
  );

  const series = useMemo(
    () =>
      sameCurrency && sharedBaselineCommitted
        ? buildComparisonSeries({ impactA, impactB, baselineCommitted: sharedBaselineCommitted })
        : null,
    [sameCurrency, sharedBaselineCommitted, impactA, impactB]
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Comparación</CardTitle>
          <CardDescription>
            Plan A vs Plan B sobre las mismas cuotas que ya tenés comprometidas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-right">Plan A · {a.currency}</TableHead>
                <TableHead className="text-right">Plan B · {b.currency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.render(metricsA, a.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.render(metricsB, b.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!sameCurrency && (
            <p className="text-muted-foreground text-sm">
              Los planes están en monedas distintas ({a.currency} y {b.currency}): se comparan
              por separado, sin gráfico (no se mezclan monedas).
            </p>
          )}
        </CardContent>
      </Card>

      {series && (
        <Card>
          <CardHeader>
            <CardTitle>Comprometido por mes · {a.currency}</CardTitle>
            <CardDescription>
              Total comprometido (lo de hoy + esta compra) de cada plan
              {income !== null && a.currency === defaultCurrency &&
                " — la línea punteada es tu ingreso"}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ComparisonChart
              currency={a.currency}
              income={a.currency === defaultCurrency ? income : null}
              aName="Plan A"
              bName="Plan B"
              data={series}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
