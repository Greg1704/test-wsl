"use client";

import { useState } from "react";
import { toast } from "sonner";

import { deleteSubscription } from "@/server/actions/subscriptions";
import { Button } from "@/components/ui/button";

/**
 * Elimina una suscripción (confirmación inline, mismo patrón que desactivar tarjeta). Solo lo
 * renderiza el padre para suscripciones SIN cobros pagados; el server igual bloquea el borrado
 * si tiene pagos (guard duro, defensa en profundidad → se archiva en vez de borrar).
 */
export function DeleteSubscriptionButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleDelete() {
    setIsPending(true);
    try {
      await deleteSubscription(id);
      toast.success("Suscripción eliminada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos eliminar la suscripción.");
      setIsPending(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Eliminar
      </Button>
    );
  }

  return (
    <div className="flex gap-1">
      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
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
