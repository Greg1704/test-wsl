"use client";

import { useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";

import type { Card, Category } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { purchaseSchema, type PurchaseFormValues } from "@/lib/validation/purchase";
import { createPurchase } from "@/server/actions/purchases";
import { generateInstallments, impliedMonthlyRate } from "@/server/lib/installments";
import { currencyToCents, formatMoney } from "@/server/lib/money";
import { formatDate } from "@/server/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INSTALLMENT_OPTIONS = Array.from({ length: 60 }, (_, i) => i + 1);
/** Centinela para "Sin categoría" (un Select de Radix no admite value=""). */
const NO_CATEGORY = "__none__";

// Solo los campos que el formulario realmente usa. Pasar el objeto Card/Category
// completo a este Client Component infla el payload RSC y, con varias instancias
// en la página, el serializador de Next (dev) deja de renderizar algunas.
export type PurchaseFormCard = Pick<
  Card,
  "id" | "name" | "bank" | "last4" | "currency" | "closingDay" | "dueDay"
>;
export type PurchaseFormCategory = Pick<Category, "id" | "name">;

type Props = {
  cards: PurchaseFormCard[];
  categories: PurchaseFormCategory[];
  trigger: React.ReactNode;
};

export function PurchaseFormDialog({ cards, categories, trigger }: Props) {
  const [open, setOpen] = useState(false);

  const defaultValues: PurchaseFormValues = {
    cardId: "",
    categoryId: undefined,
    description: "",
    merchant: "",
    totalAmount: undefined as unknown as number,
    currency: "ARS",
    totalInstallments: 1,
    purchaseDate: new Date(),
    financedTotal: undefined,
    notes: "",
  };

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues,
  });

  // La compra hereda la moneda de la tarjeta elegida.
  function onCardChange(cardId: string) {
    form.setValue("cardId", cardId);
    const card = cards.find((c) => c.id === cardId);
    if (card) form.setValue("currency", card.currency as "ARS" | "USD");
  }

  // Preview en vivo de las cuotas (reusa la lógica pura de dominio, sin tocar la
  // DB). Es un adelanto del simulador de la Fase 4. Usamos `useWatch` por campo
  // (no `form.watch()`) para suscribirnos de forma reactiva con deps estables.
  const cardId = useWatch({ control: form.control, name: "cardId" });
  const totalAmount = useWatch({ control: form.control, name: "totalAmount" });
  const totalInstallments = useWatch({ control: form.control, name: "totalInstallments" });
  const financedTotal = useWatch({ control: form.control, name: "financedTotal" });
  const purchaseDate = useWatch({ control: form.control, name: "purchaseDate" });

  const preview = useMemo(() => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || !totalAmount || totalAmount <= 0) return null;
    // El total que se reparte es el final (con recargo); sin recargo, el monto.
    const hasSurcharge = !!financedTotal && financedTotal > totalAmount;
    const financed = hasSurcharge ? financedTotal! : totalAmount;
    const n = totalInstallments || 1;
    try {
      const rows = generateInstallments({
        cardClosingDay: card.closingDay,
        cardDueDay: card.dueDay,
        purchaseDate: purchaseDate ?? new Date(),
        totalInstallments: n,
        totalAmountCents: currencyToCents(financed),
        currency: card.currency,
      });
      const total = rows.reduce((acc, r) => acc + r.amountCents, 0n);
      // Recargo % y TEM derivada, solo si hay interés.
      const surchargePct = hasSurcharge ? (financed / totalAmount - 1) * 100 : 0;
      const tem = hasSurcharge
        ? impliedMonthlyRate(currencyToCents(totalAmount), currencyToCents(financed), n)
        : 0;
      return { rows, total, currency: card.currency, hasSurcharge, surchargePct, tem };
    } catch {
      return null;
    }
  }, [cards, cardId, totalAmount, totalInstallments, financedTotal, purchaseDate]);

  async function onSubmit(raw: PurchaseFormValues) {
    // Los opcionales vacíos se mandan como undefined (no como "").
    const payload: PurchaseFormValues = {
      ...raw,
      merchant: raw.merchant || undefined,
      notes: raw.notes || undefined,
      categoryId: raw.categoryId || undefined,
      financedTotal: raw.financedTotal || undefined,
    };

    try {
      await createPurchase(payload);
      toast.success("Compra registrada");
      form.reset(defaultValues);
      setOpen(false);
    } catch {
      toast.error("No pudimos registrar la compra. Intentá de nuevo.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // El modal abre siempre limpio.
        if (o) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva compra</DialogTitle>
          <DialogDescription>
            Registrá una compra en cuotas; calculamos los vencimientos según el ciclo
            de la tarjeta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="cardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarjeta</FormLabel>
                  <Select value={field.value || undefined} onValueChange={onCardChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegí una tarjeta…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.bank} ···· {c.last4} ({c.currency})
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Notebook Lenovo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 items-start gap-4">
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto total</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : e.target.valueAsNumber
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
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

            <div className="grid grid-cols-2 items-start gap-4">
              <FormField
                control={form.control}
                name="totalInstallments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuotas</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INSTALLMENT_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
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
                name="financedTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total con recargo (opc.)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="Sin interés"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : e.target.valueAsNumber
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de compra</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {field.value ? formatDate(field.value) : "Elegí una fecha"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 items-start gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría (opc.)</FormLabel>
                    <Select
                      value={field.value || NO_CATEGORY}
                      onValueChange={(v) =>
                        field.onChange(v === NO_CATEGORY ? undefined : v)
                      }
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
                      <Input placeholder="Garbarino" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opc.)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Regalo de cumpleaños…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {preview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {preview.rows.length}{" "}
                  {preview.rows.length === 1 ? "cuota" : "cuotas"} de{" "}
                  {formatMoney(preview.rows[0].amountCents, preview.currency)}
                  {preview.rows.length > 1 &&
                    preview.rows[preview.rows.length - 1].amountCents !==
                      preview.rows[0].amountCents &&
                    ` (última: ${formatMoney(
                      preview.rows[preview.rows.length - 1].amountCents,
                      preview.currency
                    )})`}
                </p>
                <p className="text-muted-foreground">
                  Primer vencimiento: {formatDate(preview.rows[0].dueDate)}
                </p>
                {preview.hasSurcharge && (
                  <p className="text-muted-foreground">
                    Total a pagar: {formatMoney(preview.total, preview.currency)} · Recargo
                    +{preview.surchargePct.toFixed(1)}% · TEM ≈ {preview.tem.toFixed(1)}%/mes
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Guardando…" : "Registrar compra"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
