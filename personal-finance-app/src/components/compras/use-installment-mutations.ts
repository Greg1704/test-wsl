"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markInstallmentPaid, revertInstallment } from "@/server/actions/installments";

/**
 * Lógica compartida para marcar/revertir cuotas desde el cliente. La usan tanto el
 * listado del detalle de compra como el modal del dashboard.
 *
 * Cada acción es un Server Action que ya revalida sus rutas (`revalidatePath`);
 * `router.refresh()` vuelve a pedir el RSC abierto para reflejar el nuevo estado
 * sin recargar la página. `isPending` deshabilita los botones mientras corre.
 */
export function useInstallmentMutations() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(okMsg);
        router.refresh();
      } catch {
        toast.error("No pudimos actualizar la cuota. Intentá de nuevo.");
      }
    });
  }

  return {
    isPending,
    markPaid: (id: string, paidFromSavings = true) =>
      run(() => markInstallmentPaid(id, paidFromSavings), "Cuota marcada como pagada"),
    revert: (id: string) => run(() => revertInstallment(id), "Cuota revertida"),
  };
}
