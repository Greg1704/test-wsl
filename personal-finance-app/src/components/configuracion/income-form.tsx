"use client";

import { useState } from "react";
import { useForm, type Control, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { incomeSchema, type IncomeFormValues } from "@/lib/validation/settings";
import { updateMonthlyIncome } from "@/server/actions/settings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type IncomeFormInitial = {
  defaultCurrency: "ARS" | "USD";
  incomeArs: number | undefined;
  incomeUsd: number | undefined;
};

/**
 * Campo de monto editable como texto: permite dejarlo VACÍO mientras se edita (un
 * <input type=number> controlado se traba en estados intermedios) y tipear decimales.
 * El form guarda `number | undefined`; vacío ⇒ undefined. Mismo patrón que usaba el
 * ingreso único; extraído para reusarlo en ARS y USD.
 */
function MoneyField({
  control,
  name,
  label,
  initial,
}: {
  control: Control<IncomeFormValues>;
  name: FieldPath<IncomeFormValues>;
  label: string;
  initial: number | undefined;
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
                // Solo dígitos y un separador decimal (coma → punto). Vacío permitido;
                // "." suelto (NaN) ⇒ sin valor para el form.
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
        </FormItem>
      )}
    />
  );
}

export function IncomeForm({ initial }: { initial: IncomeFormInitial }) {
  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: IncomeFormValues) {
    try {
      await updateMonthlyIncome(values);
      toast.success("Configuración guardada");
    } catch {
      toast.error("No pudimos guardar la configuración.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="defaultCurrency"
          render={({ field }) => (
            <FormItem className="max-w-[12rem]">
              <FormLabel>Moneda principal</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ARS">ARS (pesos)</SelectItem>
                  <SelectItem value="USD">USD (dólares)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 items-start gap-4">
          <MoneyField
            control={form.control}
            name="incomeArs"
            label="Ingreso mensual (ARS)"
            initial={initial.incomeArs}
          />
          <MoneyField
            control={form.control}
            name="incomeUsd"
            label="Ingreso mensual (USD)"
            initial={initial.incomeUsd}
          />
        </div>

        <p className="text-muted-foreground text-sm">
          El disponible neto se calcula por moneda: ingreso − cuotas del mes. Cambiar el
          ingreso aplica desde este mes en adelante; los meses pasados conservan su valor.
        </p>

        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
