import { useMemo } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { simulatorSchema, type SimulatorFormValues } from "@/lib/validation/simulator";
import { buildPurchasePlan, type PurchasePlan } from "@/server/lib/purchase-plan";
import {
  buildSimulationImpact,
  type BaselineMonth,
  type SimulationImpact,
} from "@/server/lib/simulation";
import { currencyToCents } from "@/server/lib/money";
import type { ScenarioContext, SimCard } from "./types";

export type Scenario = {
  form: UseFormReturn<SimulatorFormValues>;
  selectedCard: SimCard | undefined;
  currency: string;
  /** Monedas que opera la tarjeta elegida (para el select de moneda del form). */
  currencyOptions: string[];
  /** Cambia la moneda del plan (debe ser una de `currencyOptions`). */
  setCurrency: (c: string) => void;
  plan: PurchasePlan | null;
  impact: SimulationImpact | null;
};

/**
 * Estado y derivados de UN escenario del simulador: su form, el plan
 * (`buildPurchasePlan`) y el impacto sobre el flujo (`buildSimulationImpact`),
 * recalculados reactivamente. Se usa una vez por escenario (A y B en la v2);
 * todo el cómputo es cliente, sobre la lógica pura compartida.
 */
export function useScenario(cards: SimCard[], ctx: ScenarioContext): Scenario {
  const { monthLabels, startYear, startMonth, defaultCurrency, income, baselines } = ctx;

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
  const currencyValue = useWatch({ control: form.control, name: "currency" });

  const selectedCard = cards.find((c) => c.id === cardId);
  const currencyOptions = selectedCard?.currencies ?? [];
  // Default = la moneda principal del usuario (Configuración) si la tarjeta la opera;
  // si no, la primera de la tarjeta. Si el usuario ya eligió una válida, se respeta.
  const preferred = currencyOptions.includes(defaultCurrency)
    ? defaultCurrency
    : currencyOptions[0];
  const currency =
    currencyValue && currencyOptions.includes(currencyValue)
      ? currencyValue
      : (preferred ?? defaultCurrency);
  const setCurrency = (c: string) => form.setValue("currency", c as "ARS" | "USD");

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
        currency,
      });
    } catch {
      return null;
    }
  }, [selectedCard, totalAmount, totalInstallments, financedTotal, purchaseDate, currency]);

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

  return { form, selectedCard, currency, currencyOptions, setCurrency, plan, impact };
}
