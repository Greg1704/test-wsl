"use client";

import { createElement, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Ban } from "lucide-react";

import { cn } from "@/lib/utils";
import { categorySchema, type CategoryFormValues } from "@/lib/validation/category";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/server/actions/categories";
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
  categoryIcon,
} from "@/lib/category-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** Solo los campos que el manager usa (regla rsc-y-payload: DTO mínimo). */
export type CategoryListItem = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  /** Compras asociadas: quedarían sin categoría al borrar (aviso de confirmación). */
  purchaseCount: number;
};

const EMPTY: CategoryFormValues = { name: "", color: undefined, icon: undefined };

/**
 * Resuelve y renderiza el ícono de una categoría. Definido a nivel de módulo (no
 * dentro del render) porque, con el React Compiler activo, aliasar un componente en
 * una variable local en cada render dispara la regla `react-hooks/static-components`.
 */
function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const icon = categoryIcon(name);
  // createElement con binding en minúscula: aliasar a `const Icon = …` y renderizar
  // <Icon/> dispararía react-hooks/static-components (componente creado en render).
  return icon ? createElement(icon, { className }) : null;
}

export function CategoriesManagerDialog({
  categories,
}: {
  categories: CategoryListItem[];
}) {
  const [open, setOpen] = useState(false);
  // null = modo alta; un id = estamos editando esa categoría.
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: EMPTY,
  });

  // useWatch (no form.watch) para suscribirnos sin romper el React Compiler
  // (regla react-hooks/incompatible-library), igual que en purchase-form-dialog.
  const color = useWatch({ control: form.control, name: "color" });
  const icon = useWatch({ control: form.control, name: "icon" });

  function resetForm() {
    form.reset(EMPTY);
    setEditingId(null);
  }

  function startEdit(cat: CategoryListItem) {
    setEditingId(cat.id);
    form.reset({
      name: cat.name,
      color: cat.color ?? undefined,
      icon: cat.icon ?? undefined,
    });
  }

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (editingId) {
        await updateCategory(editingId, values);
        toast.success("Categoría actualizada");
      } else {
        await createCategory(values);
        toast.success("Categoría creada");
      }
      resetForm();
    } catch (e) {
      // createCategory lanza un mensaje propio si el nombre está duplicado.
      toast.error(e instanceof Error ? e.message : "No pudimos guardar la categoría.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) resetForm(); // el modal abre siempre limpio
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Categorías</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>
            Organizá tus compras por categoría. Las podés usar al registrar una compra
            y para filtrar el listado.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{editingId ? "Editar categoría" : "Nueva categoría"}</FormLabel>
                  <FormControl>
                    <Input placeholder="Supermercado" maxLength={40} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Color</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                    onClick={() => form.setValue("color", color === c ? undefined : c)}
                    className={cn(
                      "size-6 rounded-full ring-offset-2 ring-offset-background transition-[box-shadow]",
                      color === c && "ring-2 ring-foreground"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Ícono (opcional)</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Sin ícono"
                  aria-pressed={!icon}
                  onClick={() => form.setValue("icon", undefined)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border text-muted-foreground",
                    !icon && "border-foreground ring-1 ring-foreground"
                  )}
                >
                  <Ban className="size-4" />
                </button>
                {CATEGORY_ICON_NAMES.map((name) => {
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-label={name}
                      aria-pressed={icon === name}
                      onClick={() => form.setValue("icon", name)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md border",
                        icon === name && "border-foreground ring-1 ring-foreground"
                      )}
                    >
                      <CategoryIcon name={name} className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Agregar categoría"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Form>

        <div className="grid gap-2 border-t pt-4">
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no tenés categorías.</p>
          ) : (
            categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                isEditing={editingId === cat.id}
                onEdit={() => startEdit(cat)}
                onDeleted={() => editingId === cat.id && resetForm()}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  category,
  isEditing,
  onEdit,
  onDeleted,
}: {
  category: CategoryListItem;
  isEditing: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const hasPurchases = category.purchaseCount > 0;

  async function handleDelete() {
    setPending(true);
    try {
      await deleteCategory(category.id);
      toast.success("Categoría eliminada");
      setConfirmOpen(false);
      onDeleted();
    } catch {
      toast.error("No pudimos eliminar la categoría.");
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
        isEditing && "border-foreground/40 bg-muted/40"
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: category.color ?? "var(--muted)" }}
      >
        <CategoryIcon name={category.icon} className="size-4 text-white" />
      </span>
      <span className="font-medium">{category.name}</span>
      {hasPurchases && (
        <span className="text-muted-foreground text-xs">
          {category.purchaseCount} {category.purchaseCount === 1 ? "compra" : "compras"}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
        {/* Confirmación en un modal aparte (no inline): así el aviso de compras
            asociadas no descoloca la fila ni genera scrollbars en el manager. */}
        <Dialog
          open={confirmOpen}
          onOpenChange={(o) => {
            if (!pending) setConfirmOpen(o);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Borrar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar categoría</DialogTitle>
              <DialogDescription>
                {hasPurchases
                  ? `Hay ${category.purchaseCount} ${category.purchaseCount === 1 ? "compra asociada" : "compras asociadas"} a «${category.name}». Si la eliminás, ${category.purchaseCount === 1 ? "esa compra queda" : "esas compras quedan"} sin categoría. ¿Querés eliminarla igual?`
                  : `¿Querés eliminar la categoría «${category.name}»? Esta acción no se puede deshacer.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                {pending ? "Eliminando…" : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
