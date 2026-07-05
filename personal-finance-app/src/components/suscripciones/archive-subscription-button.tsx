"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { archiveSubscription } from "@/server/actions/subscriptions";
import { Button } from "@/components/ui/button";

/**
 * Archiva (desactiva) una suscripción con pagos: sale de la lista activa y deja de generar
 * cobros, conservando el historial. Reversible (Reactivar desde el modal de cerradas), por eso
 * no pide confirmación.
 */
export function ArchiveSubscriptionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await archiveSubscription(id);
            toast.success("Suscripción archivada");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No pudimos archivar la suscripción.");
          }
        })
      }
    >
      Archivar
    </Button>
  );
}
