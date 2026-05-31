"use client";

import { CreditCard } from "lucide-react";

import type { Card as CardModel } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { findBank } from "@/lib/banks";
import { formatExpiration } from "@/server/lib/dates";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardFormDialog } from "@/components/tarjetas/card-form-dialog";
import { DeactivateCardButton } from "@/components/tarjetas/deactivate-card-button";

export function CardItem({ card }: { card: CardModel }) {
  // Banco conocido → color de fondo de marca; "Otro"/sin banco → neutro.
  const bank = findBank(card.bank);

  return (
    // TODO (futuro): ícono del banco en una esquina del header (bank.icon).
    <Card size="sm" className={cn(bank?.cardClass)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          {card.name}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          {card.bank && <span className="text-foreground font-medium">{card.bank}</span>}
          {card.brand && <span>{card.brand}</span>}
          {card.last4 && <span>•••• {card.last4}</span>}
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
            {card.currency}
          </span>
        </div>
        {card.owner && <p>Dueño: {card.owner}</p>}
        <p>
          Cierre día {card.closingDay} · Vence día {card.dueDay}
        </p>
        <p>Vto. tarjeta: {formatExpiration(card.expirationDate)}</p>
      </CardContent>

      <CardFooter className="gap-2">
        <CardFormDialog
          card={card}
          trigger={
            <Button variant="outline" size="sm">
              Editar
            </Button>
          }
        />
        <DeactivateCardButton cardId={card.id} />
      </CardFooter>
    </Card>
  );
}
