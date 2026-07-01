"use client";

import { useState } from "react";

import type { CardView } from "@/lib/card-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReactivateCardButton } from "@/components/tarjetas/reactivate-card-button";

export function DeactivatedCardsDialog({ cards }: { cards: CardView[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Ver desactivadas ({cards.length})</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tarjetas desactivadas</DialogTitle>
          <DialogDescription>
            Reactivá una tarjeta para volver a usarla en compras nuevas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {cards.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No tenés tarjetas desactivadas.
            </p>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{card.name}</span>
                <span className="text-muted-foreground">
                  {card.bank} · •••• {card.last4}
                </span>
                <div className="ml-auto">
                  <ReactivateCardButton cardId={card.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
