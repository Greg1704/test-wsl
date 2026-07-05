"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Centinelas de los selects (Radix no admite value=""). */
export const ALL = "__all__";
export const NONE = "__none__";

export type SubscriptionFilterValues = {
  search: string;
  cardId: string; // ALL | NONE | cardId
  categoryId: string; // ALL | NONE | categoryId
  method: string; // ALL | "CREDIT" | "DEBIT"
};

type Option = { id: string; name: string };

/**
 * Filtros de suscripciones con estética de la sección de compras: panel con fondo propio y
 * título chico arriba de cada control. Filtrado en memoria (instantáneo), controlado por el
 * padre vía `value`/`onChange`.
 */
export function SubscriptionFilters({
  cards,
  categories,
  value,
  onChange,
}: {
  cards: Option[];
  categories: Option[];
  value: SubscriptionFilterValues;
  onChange: (next: SubscriptionFilterValues) => void;
}) {
  const set = (patch: Partial<SubscriptionFilterValues>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <label className="text-muted-foreground text-xs">Buscar</label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Nombre…"
              value={value.search}
              onChange={(e) => set({ search: e.target.value })}
              className="pl-8"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">Tarjeta</label>
          <Select value={value.cardId} onValueChange={(v) => set({ cardId: v })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              <SelectItem value={NONE}>Sin tarjeta</SelectItem>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">Categoría</label>
          <Select value={value.categoryId} onValueChange={(v) => set({ categoryId: v })}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              <SelectItem value={NONE}>Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">Medio de pago</label>
          <Select value={value.method} onValueChange={(v) => set({ method: v })}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="CREDIT">Crédito</SelectItem>
              <SelectItem value="DEBIT">Débito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
