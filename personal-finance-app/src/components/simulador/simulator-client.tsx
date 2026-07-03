"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useScenario } from "./use-scenario";
import { ScenarioForm } from "./scenario-form";
import { ScenarioImpact } from "./scenario-impact";
import { ScenarioUtilization } from "./scenario-utilization";
import { ComparisonView } from "./comparison-view";
import type { ScenarioContext, SimCard } from "./types";

// Re-export para que el Server Component (page.tsx) siga importando desde acá.
export type { SimCard, SimBaseline } from "./types";

export type SimulatorClientProps = {
  cards: SimCard[];
} & ScenarioContext;

export function SimulatorClient({ cards, ...ctx }: SimulatorClientProps) {
  const { monthLabels, defaultCurrency, income, baselines } = ctx;
  const [comparing, setComparing] = useState(false);

  // Un escenario por plan. Ambos hooks corren siempre (reglas de hooks); B se usa
  // solo al comparar, y su estado persiste al togglear porque vive acá, en el padre.
  const a = useScenario(cards, ctx);
  const b = useScenario(cards, ctx);

  // Baseline de la moneda compartida para el chart overlay (null si A y B difieren).
  const sharedBaselineCommitted = useMemo(() => {
    if (a.currency !== b.currency) return null;
    const base = baselines.find((x) => x.currency === a.currency);
    return base?.committed ?? monthLabels.map(() => 0);
  }, [a.currency, b.currency, baselines, monthLabels]);

  const bothReady = a.plan && a.impact && b.plan && b.impact;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
        <p className="text-muted-foreground text-sm">
          Probá una compra antes de hacerla y mirá cómo te queda el flujo futuro. No se
          guarda nada.
        </p>
      </header>

      {comparing ? (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <ScenarioForm
            form={a.form}
            cards={cards}
            plan={a.plan}
            currency={a.currency}
            currencyOptions={a.currencyOptions}
            onCurrencyChange={a.setCurrency}
            showLimitRate={a.needsLimitRate}
            limitCurrency={a.limitCurrency}
            title="Plan A"
            description="Tarjeta, monto y cuotas de este plan."
          />
          <ScenarioForm
            form={b.form}
            cards={cards}
            plan={b.plan}
            currency={b.currency}
            currencyOptions={b.currencyOptions}
            onCurrencyChange={b.setCurrency}
            showLimitRate={b.needsLimitRate}
            limitCurrency={b.limitCurrency}
            title="Plan B"
            description="El plan a comparar contra A."
            onRemove={() => setComparing(false)}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          <ScenarioForm
            form={a.form}
            cards={cards}
            plan={a.plan}
            currency={a.currency}
            currencyOptions={a.currencyOptions}
            onCurrencyChange={a.setCurrency}
            showLimitRate={a.needsLimitRate}
            limitCurrency={a.limitCurrency}
          />
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => setComparing(true)}
          >
            <Plus /> Comparar con otro plan
          </Button>
        </div>
      )}

      {comparing ? (
        bothReady ? (
          <ComparisonView
            a={a}
            b={b}
            income={income}
            defaultCurrency={defaultCurrency}
            sharedBaselineCommitted={sharedBaselineCommitted}
          />
        ) : (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              Completá ambos planes (tarjeta y monto) para verlos comparados.
            </CardContent>
          </Card>
        )
      ) : a.impact ? (
        <>
          <ScenarioImpact impact={a.impact} currency={a.currency} />
          {a.selectedCard?.limit && (
            <ScenarioUtilization
              projection={a.utilization}
              needsRate={a.needsLimitRate}
              currency={a.limitCurrency}
            />
          )}
        </>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Elegí una tarjeta y un monto para ver el impacto en tu flujo futuro.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
