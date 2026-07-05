import { Repeat } from "lucide-react";

import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSubscriptionsPageData } from "@/server/actions/subscriptions";
import { listActiveCards } from "@/server/actions/cards";
import { listCategories } from "@/server/actions/categories";
import { Button } from "@/components/ui/button";
import { SubscriptionFormDialog } from "@/components/suscripciones/subscription-form-dialog";
import { SubscriptionList } from "@/components/suscripciones/subscription-list";
import { ArchivedSubscriptionsDialog } from "@/components/suscripciones/archived-subscriptions-dialog";

export default async function SuscripcionesPage() {
  const user = await requireUser();
  const [subscriptions, cards, categories, profile] = await Promise.all([
    getSubscriptionsPageData(),
    listActiveCards(),
    listCategories(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { defaultCurrency: true, trackCreditLimits: true },
    }),
  ]);

  const defaultCurrency: "ARS" | "USD" = profile?.defaultCurrency === "USD" ? "USD" : "ARS";
  const trackCreditLimits = profile?.trackCreditLimits ?? false;

  // Cerradas = dadas de baja con la fecha ya pasada (sin cobros por venir). Se sacan de la
  // lista principal y se ven en el modal de archivadas.
  const activeSubs = subscriptions.filter((s) => s.active);
  const closedSubs = subscriptions.filter((s) => !s.active);

  // DTOs mínimos para los dialogs (regla rsc-y-payload): nada de BigInt ni el row entero.
  const dialogCards = cards.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    bank: c.bank,
    last4: c.last4,
    currencies: c.currencies,
    hasCreditLimit: c.creditLimitCents != null,
  }));
  const dialogCategories = categories.map((c) => ({ id: c.id, name: c.name }));

  // Cada lugar crea su propio elemento (función, no una const reutilizada en dos slots).
  const renderNewButton = () => (
    <SubscriptionFormDialog
      cards={dialogCards}
      categories={dialogCategories}
      defaultCurrency={defaultCurrency}
      trackCreditLimits={trackCreditLimits}
      trigger={<Button>+ Nueva suscripción</Button>}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suscripciones</h1>
          <p className="text-muted-foreground text-sm">
            Cargos recurrentes que impactan tu disponible mes a mes.
          </p>
        </div>
        {subscriptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {closedSubs.length > 0 && (
              <ArchivedSubscriptionsDialog subscriptions={closedSubs} />
            )}
            {renderNewButton()}
          </div>
        )}
      </header>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Repeat className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            Todavía no cargaste suscripciones. Sumá Netflix, Spotify, el gimnasio…
          </p>
          {renderNewButton()}
        </div>
      ) : activeSubs.length > 0 ? (
        <SubscriptionList
          subscriptions={activeSubs}
          cards={dialogCards}
          categories={dialogCategories}
          defaultCurrency={defaultCurrency}
          trackCreditLimits={trackCreditLimits}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Repeat className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            No tenés suscripciones activas.{" "}
            {closedSubs.length === 1
              ? "Tenés 1 cerrada"
              : `Tenés ${closedSubs.length} cerradas`}{" "}
            (botón &quot;Cerradas&quot; arriba), o creá una nueva.
          </p>
          {renderNewButton()}
        </div>
      )}
    </div>
  );
}
