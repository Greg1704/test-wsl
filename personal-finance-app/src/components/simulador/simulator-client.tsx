"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, TrendingDown, TrendingUp } from "lucide-react";

import { simulatorSchema, type SimulatorFormValues } from "@/lib/validation/simulator";
import { buildPurchasePlan } from "@/server/lib/purchase-plan";
import {
  buildSimulationImpact,
  SIM_CARD_ID,
  type BaselineMonth,
} from "@/server/lib/simulation";
import { currencyToCents, formatMoney } from "@/server/lib/money";
import { formatDate, startOfToday } from "@/server/lib/dates";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjectionChart } from "@/components/dashboard/projection-chart";

const INSTALLMENT_OPTIONS = Array.from({ length: 60 }, (_, i) => i + 1);

export type SimCard = {
  id: string;
  name: string;
  bank: string | null;
  last4: string | null;
  currency: string;
  closingDay: number;
  dueDay: number;
};

export type SimBaseline = {
  currency: string;
  cards: { id: string; name: string }[];
  /** Largo = monthLabels.length, ceros donde no hay cuotas. */
  committed: number[];
  byCard: Record<string, number>[];
};

export type SimulatorClientProps = {
  cards: SimCard[];
  monthLabels: string[];
  startYear: number;
  startMonth: number; // 0-11
  defaultCurrency: string;
  /** Ingreso mensual en la moneda principal, o null si no está configurado. */
  income: number | null;
  baselines: SimBaseline[];
};

export function SimulatorClient({
  cards,
  monthLabels,
  startYear,
  startMonth,
  defaultCurrency,
  income,
  baselines,
}: SimulatorClientProps) {
  const form = useForm<SimulatorFormValues>({
    resolver: zodResolver(simulatorSchema),
    defaultValues: {
      cardId: "",
      totalAmount: undefined as unknown as number,
      totalInstallments: 3,
      purchaseDate: new Date(),
      financedTotal: undefined,
    },
  });

  const cardId = useWatch({ control: form.control, name: "cardId" });
  const totalAmount = useWatch({ control: form.control, name: "totalAmount" });
  const totalInstallments = useWatch({ control: form.control, name: "totalInstallments" });
  const financedTotal = useWatch({ control: form.control, name: "financedTotal" });
  const purchaseDate = useWatch({ control: form.control, name: "purchaseDate" });

  const selectedCard = cards.find((c) => c.id === cardId);
  const currency = selectedCard?.currency ?? defaultCurrency;

  // Plan de la compra hipotética: misma función pura que el preview del form de compra.
  const plan = useMemo(() => {
    if (!selectedCard || !totalAmount || totalAmount <= 0) return null;
    try {
      return buildPurchasePlan({
        cardClosingDay: selectedCard.closingDay,
        cardDueDay: selectedCard.dueDay,
        purchaseDate: purchaseDate ?? new Date(),
        totalInstallments: totalInstallments || 1,
        totalAmountCents: currencyToCents(totalAmount),
        financedTotalCents: financedTotal ? currencyToCents(financedTotal) : undefined,
        currency: selectedCard.currency,
      });
    } catch {
      return null;
    }
  }, [selectedCard, totalAmount, totalInstallments, financedTotal, purchaseDate]);

  // Impacto sobre el flujo: suma las cuotas hipotéticas al baseline de su moneda.
  const impact = useMemo(() => {
    if (!plan || !selectedCard) return null;
    const base = baselines.find((b) => b.currency === currency);
    const baselineMonths: BaselineMonth[] = monthLabels.map((label, i) => ({
      label,
      committed: base?.committed[i] ?? 0,
      byCard: base?.byCard[i] ?? {},
    }));
    // El neto (ingreso − cuotas) solo aplica en la moneda principal (RF-9.1).
    const incomeForCurrency = currency === defaultCurrency ? income : null;
    return buildSimulationImpact({
      baseline: baselineMonths,
      baselineCards: base?.cards ?? [],
      startYear,
      startMonth,
      income: incomeForCurrency,
      hypoRows: plan.rows,
    });
  }, [plan, selectedCard, baselines, currency, monthLabels, startYear, startMonth, income, defaultCurrency]);

  // El chart muestra dos series: lo ya comprometido (real) en un color y esta compra
  // (simulada) en otro, apiladas, con el ingreso como referencia.
  const REAL_KEY = "real";
  const chartCards = [
    // Lo ya comprometido va en gris neutro; la compra simulada en esmeralda de marca,
    // para que el impacto de "esta compra" salte a la vista.
    { id: REAL_KEY, name: "Comprometido", color: "var(--muted-foreground)" },
    { id: SIM_CARD_ID, name: "Esta compra", color: "var(--primary)" },
  ];
  const chartData = useMemo(
    () =>
      impact
        ? impact.months.map((m) => ({
            month: m.label,
            [REAL_KEY]: m.committedBefore,
            [SIM_CARD_ID]: m.thisPurchase,
          }))
        : [],
    [impact]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
        <p className="text-muted-foreground text-sm">
          Probá una compra antes de hacerla y mirá cómo te queda el flujo futuro. No se
          guarda nada.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Compra hipotética</CardTitle>
          <CardDescription>
            Elegí la tarjeta, el monto y las cuotas; calculamos el impacto al instante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              <FormField
                control={form.control}
                name="cardId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarjeta</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elegí una tarjeta…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cards.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} · {c.bank} ···· {c.last4} ({c.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 items-start gap-4">
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : e.target.valueAsNumber
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalInstallments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuotas</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INSTALLMENT_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 items-start gap-4">
                <FormField
                  control={form.control}
                  name="financedTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total con recargo (opc.)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="Sin interés"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : e.target.valueAsNumber
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de compra</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 size-4" />
                              {field.value ? formatDate(field.value) : "Elegí una fecha"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            // Simular una compra a futuro: no tiene sentido una fecha pasada.
                            disabled={{ before: startOfToday() }}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Resumen del plan: idéntico al preview del form de compra. */}
              {plan && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    {plan.rows.length}{" "}
                    {plan.rows.length === 1 ? "cuota" : "cuotas"} de{" "}
                    {formatMoney(plan.rows[0].amountCents, currency)}
                    {plan.rows.length > 1 &&
                      plan.rows[plan.rows.length - 1].amountCents !==
                        plan.rows[0].amountCents &&
                      ` (última: ${formatMoney(
                        plan.rows[plan.rows.length - 1].amountCents,
                        currency
                      )})`}
                  </p>
                  <p className="text-muted-foreground">
                    Primer vencimiento: {formatDate(plan.rows[0].dueDate)}
                  </p>
                  {plan.hasSurcharge && (
                    <p className="text-muted-foreground">
                      Total a pagar: {formatMoney(plan.totalCents, currency)} · Recargo +
                      {plan.surchargePct.toFixed(1)}% · TEM ≈ {plan.tem.toFixed(1)}%/mes
                    </p>
                  )}
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Resultado: chart + tabla del impacto, o invitación a completar el form. */}
      {!impact ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Elegí una tarjeta y un monto para ver el impacto en tu flujo futuro.
          </CardContent>
        </Card>
      ) : (
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
                cards={chartCards}
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
                    <TableRow
                      key={i}
                      className={cn(m.thisPurchase > 0 && "bg-primary/5")}
                    >
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
      )}
    </div>
  );
}
