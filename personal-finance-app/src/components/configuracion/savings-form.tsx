"use client";

import { useState } from "react";
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
};

/** Campo de monto editable como texto (vacío permitido, decimales con coma/punto). */
function MoneyField({
  control,
  name,
  label,
  initial,
}: {
  control: Control<SavingsFormValues>;
  name: FieldPath<SavingsFormValues>;
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

export function SavingsForm({ initial }: { initial: SavingsFormInitial }) {
  const form = useForm<SavingsFormValues>({
    resolver: zodResolver(savingsSchema),
    defaultValues: initial,
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
          />
          <MoneyField
            control={form.control}
            name="savingsUsd"
            label="Ahorro actual (USD)"
            initial={initial.savingsUsd}
          />
        </div>

        <p className="text-muted-foreground text-sm">
          Tu saldo guardado hoy. Cada mes le sumamos tu ingreso y le restamos los gastos de
          débito, transferencia y efectivo. Guardar re-ancla el saldo al mes actual.
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
