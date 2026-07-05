"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { reactivateSubscription } from "@/server/actions/subscriptions";
import { Button } from "@/components/ui/button";

/**
 * Reactiva una suscripción archivada: vuelve a la lista activa y retoma los cobros desde el
 * mes actual (limpia la baja programada). No rellena hacia atrás los meses archivados.
 */
export function ReactivateSubscriptionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await reactivateSubscription(id);
            toast.success("Suscripción reactivada");
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "No pudimos reactivar la suscripción."
            );
          }
        })
      }
    >
      Reactivar
    </Button>
  );
}
