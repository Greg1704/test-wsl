"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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

/** El ingreso puede llegar sin configurar (input vacío); por eso es opcional acá. */
type IncomeFormInitial = {
  monthlyIncome: number | undefined;
  defaultCurrency: "ARS" | "USD";
};

export function IncomeForm({ initial }: { initial: IncomeFormInitial }) {
  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: initial,
  });

  // El input se muestra desde un string local, NO desde el número del form: así se
  // puede dejar VACÍO mientras se edita (un <input type=number> controlado se traba
  // en estados intermedios) y se pueden tipear decimales sin que se borren. El form
  // guarda `number | undefined`; vacío ⇒ undefined ⇒ Zod lo rechaza al guardar.
  const [incomeText, setIncomeText] = useState(
    initial.monthlyIncome != null ? String(initial.monthlyIncome) : ""
  );

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
        <div className="grid grid-cols-2 items-start gap-4">
          <FormField
            control={form.control}
            name="monthlyIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ingreso mensual</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={incomeText}
                    onChange={(e) => {
                      // Solo dígitos y un separador decimal (coma → punto). Vacío
                      // permitido; "." suelto (NaN) ⇒ sin valor para el form.
                      let v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                      const parts = v.split(".");
                      if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
                      setIncomeText(v);
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

          <FormField
            control={form.control}
            name="defaultCurrency"
            render={({ field }) => (
              <FormItem>
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
        </div>

        <p className="text-muted-foreground text-sm">
          El disponible neto se calcula en tu moneda principal: ingreso − cuotas del mes.
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
