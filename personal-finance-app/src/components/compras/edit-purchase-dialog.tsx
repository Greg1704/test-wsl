"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import type { Category } from "@/generated/prisma/client";
import { editPurchaseSchema, type EditPurchaseFormValues } from "@/lib/validation/purchase";
import { updatePurchase } from "@/server/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const NO_CATEGORY = "__none__";

type Props = {
  purchaseId: string;
  categories: Category[];
  initial: EditPurchaseFormValues;
  trigger: React.ReactNode;
};

/**
 * Edita SOLO campos descriptivos (RF-3.6): no toca monto, cuotas ni fecha, así
 * que las cuotas ya materializadas no se recalculan.
 */
export function EditPurchaseDialog({ purchaseId, categories, initial, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaultValues: EditPurchaseFormValues = {
    description: initial.description,
    categoryId: initial.categoryId ?? undefined,
    merchant: initial.merchant ?? undefined,
    notes: initial.notes ?? undefined,
  };

  const form = useForm<EditPurchaseFormValues>({
    resolver: zodResolver(editPurchaseSchema),
    defaultValues,
  });

  async function onSubmit(raw: EditPurchaseFormValues) {
    const payload: EditPurchaseFormValues = {
      ...raw,
      merchant: raw.merchant || undefined,
      notes: raw.notes || undefined,
      categoryId: raw.categoryId || undefined,
    };
    try {
      await updatePurchase(purchaseId, payload);
      toast.success("Compra actualizada");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No pudimos actualizar la compra. Intentá de nuevo.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar compra</DialogTitle>
          <DialogDescription>
            Solo se editan los datos descriptivos; el monto y las cuotas no cambian.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    value={field.value || NO_CATEGORY}
                    onValueChange={(v) => field.onChange(v === NO_CATEGORY ? undefined : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="merchant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comercio (opc.)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opc.)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
