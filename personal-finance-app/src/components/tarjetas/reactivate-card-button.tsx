"use client";

import { useState } from "react";
import { toast } from "sonner";

import { reactivateCard } from "@/server/actions/cards";
import { Button } from "@/components/ui/button";

export function ReactivateCardButton({ cardId }: { cardId: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleReactivate() {
    setIsPending(true);
    try {
      await reactivateCard(cardId);
      toast.success("Tarjeta reactivada");
    } catch {
      toast.error("No pudimos reactivar la tarjeta.");
      setIsPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReactivate} disabled={isPending}>
      {isPending ? "Reactivando…" : "Reactivar"}
    </Button>
  );
}
