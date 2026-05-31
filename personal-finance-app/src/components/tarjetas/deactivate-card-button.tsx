"use client";

import { useState } from "react";
import { toast } from "sonner";

import { deactivateCard } from "@/server/actions/cards";
import { Button } from "@/components/ui/button";

export function DeactivateCardButton({ cardId }: { cardId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleDeactivate() {
    setIsPending(true);
    try {
      await deactivateCard(cardId);
      toast.success("Tarjeta desactivada");
    } catch {
      toast.error("No pudimos desactivar la tarjeta.");
      setIsPending(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Desactivar
      </Button>
    );
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDeactivate}
        disabled={isPending}
      >
        {isPending ? "…" : "¿Confirmar?"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={isPending}
      >
        Cancelar
      </Button>
    </div>
  );
}
