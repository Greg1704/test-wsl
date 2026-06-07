"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deletePurchase } from "@/server/actions/purchases";
import { Button } from "@/components/ui/button";

/**
 * Borra una compra (y, en cascada, sus cuotas — RF-3.7) con confirmación inline,
 * siguiendo el patrón de `deactivate-card-button`. Al borrar, vuelve al listado.
 */
export function DeletePurchaseButton({ purchaseId }: { purchaseId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setIsPending(true);
    try {
      await deletePurchase(purchaseId);
      toast.success("Compra eliminada");
      router.push("/compras");
    } catch {
      toast.error("No pudimos eliminar la compra.");
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
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? "…" : "¿Eliminar la compra y sus cuotas?"}
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
