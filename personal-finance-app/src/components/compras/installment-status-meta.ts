import type { InstallmentStatus } from "@/generated/prisma/client";

/**
 * Estilo del badge de estado de una cuota (RF-4.4). Compartido por el listado del
 * detalle de compra y el modal del dashboard, para que el estado se vea igual en
 * todos lados. El `status` ya viene computado del server (incluye OVERDUE).
 */
export const INSTALLMENT_STATUS_META: Record<
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
