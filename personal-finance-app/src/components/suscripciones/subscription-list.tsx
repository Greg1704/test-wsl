"use client";

import { useMemo, useState } from "react";

import type { SubscriptionView } from "@/server/actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SubscriptionFormDialog,
  type SubscriptionFormCard,
  type SubscriptionFormCategory,
} from "@/components/suscripciones/subscription-form-dialog";
import {
  SubscriptionFilters,
  type SubscriptionFilterValues,
  ALL,
  NONE,
} from "@/components/suscripciones/subscription-filters";
import { SubscriptionSchedule } from "@/components/suscripciones/subscription-schedule";
import { DeleteSubscriptionButton } from "@/components/suscripciones/delete-subscription-button";
import { ArchiveSubscriptionButton } from "@/components/suscripciones/archive-subscription-button";

type Props = {
  subscriptions: SubscriptionView[];
  cards: SubscriptionFormCard[];
  categories: SubscriptionFormCategory[];
  defaultCurrency: "ARS" | "USD";
  trackCreditLimits: boolean;
};

/**
 * Lista de suscripciones con filtros en memoria (búsqueda por nombre + tarjeta + categoría +
 * medio de pago). El filtrado por texto es instantáneo, sin round-trips por URL. Recibe DTOs
 * planos (regla rsc-y-payload).
 */
export function SubscriptionList({
  subscriptions,
  cards,
  categories,
  defaultCurrency,
  trackCreditLimits,
}: Props) {
  const [filters, setFilters] = useState<SubscriptionFilterValues>({
    search: "",
    cardId: ALL,
    categoryId: ALL,
    method: ALL,
  });

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return subscriptions.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (
        filters.cardId === NONE
          ? s.cardId !== null
          : filters.cardId !== ALL && s.cardId !== filters.cardId
      )
        return false;
      if (
        filters.categoryId === NONE
          ? s.categoryId !== null
          : filters.categoryId !== ALL && s.categoryId !== filters.categoryId
      )
        return false;
      if (filters.method !== ALL && s.paymentMethod !== filters.method) return false;
      return true;
    });
  }, [subscriptions, filters]);

  return (
    <div className="flex flex-col gap-4">
      <SubscriptionFilters
        cards={cards}
        categories={categories}
        value={filters}
        onChange={setFilters}
      />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">
          Ninguna suscripción coincide con los filtros.
        </p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <CardTitle className="flex items-center gap-2">
                      {s.name}
                      <Badge variant={s.paymentMethod === "CREDIT" ? "secondary" : "outline"}>
                        {s.paymentMethod === "CREDIT" ? "Crédito" : "Débito"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {s.amount} · {s.currency} por mes
                      {s.cardName && ` · ${s.cardName}`}
                      {s.categoryName && ` · ${s.categoryName}`}
                    </CardDescription>
                    <CardDescription>
                      Primer cobro: {s.firstChargeLabel}
                      {s.endLabel && ` · Baja: ${s.endLabel}`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <SubscriptionFormDialog
                      cards={cards}
                      categories={categories}
                      defaultCurrency={defaultCurrency}
                      trackCreditLimits={trackCreditLimits}
                      edit={{
                        id: s.id,
                        name: s.name,
                        amountValue: s.amountValue,
                        currency: s.currency as "ARS" | "USD",
                        paymentMethod: s.paymentMethod,
                        cardId: s.cardId,
                        categoryId: s.categoryId,
                        firstChargeDate: s.firstChargeDate,
                        endDate: s.endDate,
                        limitRateValue: s.limitRateValue,
                      }}
                      trigger={
                        <Button variant="outline" size="sm">
                          Editar
                        </Button>
                      }
                    />
                    {/* Con pagos registrados no se puede borrar (perdería el historial): se
                        archiva. Sin pagos, se elimina de verdad. */}
                    {s.hasPaidCharges ? (
                      <ArchiveSubscriptionButton id={s.id} />
                    ) : (
                      <DeleteSubscriptionButton id={s.id} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                  Próximos cobros
                </p>
                <SubscriptionSchedule subscriptionId={s.id} upcoming={s.upcoming} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
