import Link from "next/link";
import { CreditCard } from "lucide-react";

import { requireUser } from "@/server/auth/session";
import { getMonthlyOverview, getProjection } from "@/server/actions/dashboard";
import { listActiveCards, getCardsUtilization } from "@/server/actions/cards";
import { MAX_HORIZON } from "@/server/lib/simulation";
import { centsToCurrency } from "@/server/lib/money";
import { formatDate } from "@/server/lib/dates";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SimulatorClient,
  type SimBaseline,
  type SimCard,
} from "@/components/simulador/simulator-client";

export default async function SimuladorPage() {
  await requireUser();
  const now = new Date();

  // El simulador proyecta planes de CUOTAS → solo tarjetas de crédito (las de débito
  // no tienen ciclo ni cuotas que simular).
  const cardRows = (await listActiveCards()).filter((c) => c.type === "CREDIT");

  // Sin tarjetas de crédito no hay nada que simular: empujamos a crear una (RF-2).
  if (cardRows.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Simulador</h1>
          <p className="text-muted-foreground text-sm">
            Probá una compra antes de hacerla y mirá cómo te queda el flujo futuro.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Primero, una tarjeta</CardTitle>
            <CardDescription>
              El simulador calcula los vencimientos según el ciclo de tu tarjeta.
              Agregá una para empezar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/tarjetas">
                <CreditCard /> Agregar una tarjeta
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [overview, projection, utilization] = await Promise.all([
    getMonthlyOverview(now),
    getProjection(now, MAX_HORIZON),
    // Uso actual del límite por tarjeta (en la moneda principal). [] si el seguimiento
    // está apagado ⇒ el simulador no muestra la sección de utilización.
    getCardsUtilization(),
  ]);

  // Utilización actual indexada por tarjeta (usedCents/limitCents ya vienen como string).
  const utilByCard = new Map(utilization.map((u) => [u.cardId, u]));

  const cards: SimCard[] = cardRows.map((c) => {
    const util = utilByCard.get(c.id);
    return {
      id: c.id,
      name: c.name,
      bank: c.bank,
      last4: c.last4,
      currencies: c.currencies,
      // Filtradas a crédito arriba ⇒ ciclo no nulo.
      closingDay: c.closingDay!,
      dueDay: c.dueDay!,
      limit: util ? { usedCents: util.usedCents, limitCents: util.limitCents } : undefined,
    };
  });

  // Labels de los meses del horizonte (mismos índices que buildProjection).
  const startYear = now.getFullYear();
  const startMonth = now.getMonth();
  const monthLabels = Array.from({ length: MAX_HORIZON }, (_, i) =>
    formatDate(new Date(startYear, startMonth + i, 1), "MMM yy")
  );

  // Ingreso de la moneda principal (la línea de "disponible neto").
  const mainCurrency = overview.currencies.find(
    (c) => c.currency === overview.defaultCurrency
  );
  const income =
    mainCurrency?.incomeCents && mainCurrency.incomeCents > 0n
      ? centsToCurrency(mainCurrency.incomeCents)
      : null;

  // Baseline por moneda (números, regla rsc-y-payload): cuotas reales comprometidas.
  const baselines: SimBaseline[] = projection.map((serie) => ({
    currency: serie.currency,
    cards: serie.cards,
    committed: serie.months.map((m) => centsToCurrency(m.totalCents)),
    byCard: serie.months.map((m) =>
      Object.fromEntries(
        Object.entries(m.byCard).map(([id, cents]) => [id, centsToCurrency(cents)])
      )
    ),
  }));

  return (
    <SimulatorClient
      cards={cards}
      monthLabels={monthLabels}
      startYear={startYear}
      startMonth={startMonth}
      defaultCurrency={overview.defaultCurrency}
      income={income}
      baselines={baselines}
    />
  );
}
