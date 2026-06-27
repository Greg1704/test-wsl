"use client";

import { useState } from "react";

import type { InstallmentStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INSTALLMENT_STATUS_META } from "./installment-status-meta";
import { useInstallmentMutations } from "./use-installment-mutations";

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

export function InstallmentList({
  installments,
  total,
}: {
  installments: InstallmentView[];
  total: number;
}) {
  const mutations = useInstallmentMutations();

  return (
    <div className="grid gap-2">
      {installments.map((inst) => (
        <InstallmentRow key={inst.id} inst={inst} total={total} mutations={mutations} />
      ))}
    </div>
  );
}

function InstallmentRow({
  inst,
  total,
  mutations,
}: {
  inst: InstallmentView;
  total: number;
  mutations: ReturnType<typeof useInstallmentMutations>;
}) {
  const { isPending, markPaid, revert } = mutations;
  const meta = INSTALLMENT_STATUS_META[inst.status];
  const isPaid = inst.status === "PAID";
  // Por defecto la cuota se descuenta del ahorro (decisión de producto).
  const [fromSavings, setFromSavings] = useState(true);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-2.5 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {inst.installmentNumber}/{total}
      </span>
      <span className="font-medium">{inst.amount}</span>
      <span className="text-muted-foreground">vence {inst.dueDate}</span>
      <Badge variant={meta.variant} className={cn(meta.className)}>
        {meta.label}
      </Badge>
      <div className="ml-auto flex items-center gap-3">
        {isPaid ? (
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => revert(inst.id)}>
            Revertir
          </Button>
        ) : (
          <>
            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-primary size-3.5"
                checked={fromSavings}
                onChange={(e) => setFromSavings(e.target.checked)}
              />
              Descontar de ahorros
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => markPaid(inst.id, fromSavings)}
            >
              Marcar pagada
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
