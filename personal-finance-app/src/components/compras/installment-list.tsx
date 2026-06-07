"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { InstallmentStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { markInstallmentPaid, revertInstallment } from "@/server/actions/installments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Cuota ya serializada para el cliente (sin BigInt; montos formateados). */
export type InstallmentView = {
  id: string;
  installmentNumber: number;
  amount: string;
  dueDate: string;
  /** Estado ya computado en el server (incluye OVERDUE, RF-4.4). */
  status: InstallmentStatus;
  paidAt: string | null;
};

const STATUS_META: Record<
  InstallmentStatus,
  { label: string; variant: "outline" | "destructive"; className?: string }
> = {
  PENDING: { label: "Pendiente", variant: "outline" },
  PAID: {
    label: "Pagada",
    variant: "outline",
    className:
      "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  OVERDUE: { label: "Vencida", variant: "destructive" },
};

export function InstallmentList({
  installments,
  total,
}: {
  installments: InstallmentView[];
  total: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(okMsg);
        // El Server Action ya revalidó la ruta; refrescamos el RSC abierto.
        router.refresh();
      } catch {
        toast.error("No pudimos actualizar la cuota. Intentá de nuevo.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      {installments.map((inst) => {
        const meta = STATUS_META[inst.status];
        const isPaid = inst.status === "PAID";
        return (
          <div
            key={inst.id}
            className="flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm"
          >
            <span className="text-muted-foreground tabular-nums">
              {inst.installmentNumber}/{total}
            </span>
            <span className="font-medium">{inst.amount}</span>
            <span className="text-muted-foreground">vence {inst.dueDate}</span>
            <Badge variant={meta.variant} className={cn(meta.className)}>
              {meta.label}
            </Badge>
            <div className="ml-auto">
              {isPaid ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => revertInstallment(inst.id), "Cuota revertida")}
                >
                  Revertir
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(() => markInstallmentPaid(inst.id), "Cuota marcada como pagada")
                  }
                >
                  Marcar pagada
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
