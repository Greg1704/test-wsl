"use client";

import { useState, useSyncExternalStore } from "react";
import { useForm, type Control, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { savingsSchema, type SavingsFormValues } from "@/lib/validation/settings";
import { updateSavingsBalance } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type SavingsFormInitial = {
  savingsArs: number | undefined;
  savingsUsd: number | undefined;
  /** ISO string del instante de última declaración por moneda, o `null` si nunca se declaró. */
  updatedArs: string | null;
  updatedUsd: string | null;
};

const noopSubscribe = () => () => {};

/**
 * "Última actualización" de una moneda. El instante se formatea en la TZ REAL del navegador
 * (no la del server, que corre en UTC), así que el valor difiere server↔cliente. `useSyncExternalStore`
 * da un snapshot de servidor estable ("…") y otro de cliente (la hora local): React renderiza
 * primero el de servidor —evitando el hydration mismatch— y recién tras hidratar muestra la hora.
 */
function LastUpdated({ iso }: { iso: string | null }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true, // cliente
    () => false // servidor / SSR
  );

  if (!iso) return <p className="text-muted-foreground text-xs">Sin registro</p>;
  const text = isClient
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "…";
  return (
    <p className="text-muted-foreground text-xs">Última actualización: {text}</p>
  );
}

/** Campo de monto editable como texto (vacío permitido, decimales con coma/punto). */
function MoneyField({
  control,
  name,
  label,
  initial,
  updatedAt,
}: {
  control: Control<SavingsFormValues>;
  name: FieldPath<SavingsFormValues>;
  label: string;
  initial: number | undefined;
  updatedAt: string | null;
}) {
  const [text, setText] = useState(initial != null ? String(initial) : "");
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={text}
              onChange={(e) => {
                let v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                const parts = v.split(".");
                if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
                setText(v);
                const n = Number(v);
                field.onChange(v === "" || Number.isNaN(n) ? undefined : n);
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          <FormMessage />
          <LastUpdated iso={updatedAt} />
        </FormItem>
      )}
    />
  );
}

export function SavingsForm({ initial }: { initial: SavingsFormInitial }) {
  const form = useForm<SavingsFormValues>({
    resolver: zodResolver(savingsSchema),
    defaultValues: { savingsArs: initial.savingsArs, savingsUsd: initial.savingsUsd },
  });

  async function onSubmit(values: SavingsFormValues) {
    try {
      await updateSavingsBalance(values);
      toast.success("Ahorro actualizado");
    } catch {
      toast.error("No pudimos guardar el ahorro.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid grid-cols-2 items-start gap-4">
          <MoneyField
            control={form.control}
            name="savingsArs"
            label="Ahorro actual (ARS)"
            initial={initial.savingsArs}
            updatedAt={initial.updatedArs}
          />
          <MoneyField
            control={form.control}
            name="savingsUsd"
            label="Ahorro actual (USD)"
            initial={initial.savingsUsd}
            updatedAt={initial.updatedUsd}
          />
        </div>

        <p className="text-muted-foreground text-sm">
          Tu saldo guardado. Cada mes le sumamos tu ingreso y le restamos los gastos de
          débito, transferencia y efectivo. Guardar re-ancla el saldo al momento actual (lo
          anterior queda reflejado; solo lo posterior se descuenta).
        </p>

        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Guardando…" : "Guardar ahorro"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
