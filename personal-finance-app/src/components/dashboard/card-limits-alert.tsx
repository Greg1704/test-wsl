import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { utilizationLevel } from "@/server/lib/card-utilization";
import { Button } from "@/components/ui/button";

type AlertCard = {
  cardId: string;
  name: string;
  currency: string;
  percent: number;
};

/**
 * Banner del dashboard que avisa cuando una o más tarjetas están cerca (ámbar) o por
 * encima (rojo) de su límite de crédito. No repite la barra de cada tarjeta (eso vive
 * en la sección de tarjetas): acá solo la señal accionable. No renderiza nada si no hay
 * tarjetas en riesgo. Server Component.
 */
export function CardLimitsAlert({ cards }: { cards: AlertCard[] }) {
  if (cards.length === 0) return null;

  // Rojo si alguna se pasó del límite; ámbar si solo están cerca.
  const anyOver = cards.some((c) => utilizationLevel(c.percent) === "over");
  const tone = anyOver
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-amber-400/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-4 shrink-0" />
        <p className="text-sm">
          {cards.map((c, i) => (
            <span key={c.cardId}>
              {i > 0 && ", "}
              <span className="font-medium">{c.name}</span> al{" "}
              {c.percent.toLocaleString("es-AR")}% del límite ({c.currency})
            </span>
          ))}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/tarjetas">Ver tarjetas</Link>
      </Button>
    </div>
  );
}
