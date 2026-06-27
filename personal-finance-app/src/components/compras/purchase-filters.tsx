"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NO_CATEGORY_FILTER } from "@/lib/validation/purchase";

/** Centinela para "todas" (un Select de Radix no admite value=""). */
const ALL = "__all__";

type Option = { id: string; label: string };

export type PurchaseFilterValues = {
  cardId?: string;
  categoryId?: string;
  currency?: string;
  paymentMethod?: string;
  month?: string; // "YYYY-MM"
};

/** Opciones del filtro de medio de pago (mismo orden que el form de compra). */
const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "CREDIT", label: "Crédito" },
  { value: "DEBIT", label: "Débito" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CASH", label: "Efectivo" },
];

export function PurchaseFilters({
  cards,
  categories,
  current,
}: {
  cards: Option[];
  categories: Option[];
  current: PurchaseFilterValues;
}) {
  const router = useRouter();

  function apply(next: PurchaseFilterValues) {
    const params = new URLSearchParams();
    if (next.cardId) params.set("cardId", next.cardId);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.currency) params.set("currency", next.currency);
    if (next.paymentMethod) params.set("paymentMethod", next.paymentMethod);
    if (next.month) params.set("month", next.month);
    const qs = params.toString();
    router.push(qs ? `/compras?${qs}` : "/compras");
  }

  const hasFilters = Boolean(
    current.cardId ||
      current.categoryId ||
      current.currency ||
      current.paymentMethod ||
      current.month
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Tarjeta</label>
        <Select
          value={current.cardId ?? ALL}
          onValueChange={(v) =>
            apply({ ...current, cardId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {cards.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Categoría</label>
        <Select
          value={current.categoryId ?? ALL}
          onValueChange={(v) =>
            apply({ ...current, categoryId: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            <SelectItem value={NO_CATEGORY_FILTER}>Sin categoría</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Moneda</label>
        <Select
          value={current.currency ?? ALL}
          onValueChange={(v) =>
            apply({ ...current, currency: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            <SelectItem value="ARS">ARS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Medio de pago</label>
        <Select
          value={current.paymentMethod ?? ALL}
          onValueChange={(v) =>
            apply({ ...current, paymentMethod: v === ALL ? undefined : v })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Mes de compra</label>
        <Input
          type="month"
          className="w-40"
          value={current.month ?? ""}
          onChange={(e) =>
            apply({ ...current, month: e.target.value || undefined })
          }
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => apply({})}>
          Limpiar
        </Button>
      )}
    </div>
  );
}
