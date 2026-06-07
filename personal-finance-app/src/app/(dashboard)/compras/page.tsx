import Link from "next/link";
import { ShoppingBag, CreditCard } from "lucide-react";

import { listPurchases } from "@/server/actions/purchases";
import { listActiveCards } from "@/server/actions/cards";
import { listCategories } from "@/server/actions/categories";
import type { PurchaseFilters as Filters } from "@/lib/validation/purchase";
import { formatMoney } from "@/server/lib/money";
import { formatDate } from "@/server/lib/dates";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseFormDialog } from "@/components/compras/purchase-form-dialog";
import { PurchaseFilters } from "@/components/compras/purchase-filters";
import { CategoriesManagerDialog } from "@/components/categorias/categories-manager-dialog";

type SearchParams = {
  cardId?: string;
  categoryId?: string;
  currency?: string;
  month?: string; // "YYYY-MM"
};

/** "YYYY-MM" → primer día de ese mes (la action filtra por el rango del mes). */
function monthToDate(month?: string): Date | undefined {
  if (!month) return undefined;
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const filters: Filters = {
    cardId: sp.cardId,
    categoryId: sp.categoryId,
    currency: sp.currency === "ARS" || sp.currency === "USD" ? sp.currency : undefined,
    month: monthToDate(sp.month),
  };

  // Server Component: lee la DB directo. El dinero se formatea acá (server),
  // así ningún BigInt cruza el borde hacia el cliente.
  const [purchases, cards, categories] = await Promise.all([
    listPurchases(filters),
    listActiveCards(),
    listCategories(),
  ]);

  // Al diálogo le pasamos solo los campos que usa (no el objeto Card/Category
  // completo): así el payload que cruza al cliente es chico y el serializador RSC
  // renderiza el botón de forma fiable aunque haya varias instancias en la página.
  const dialogCards = cards.map((c) => ({
    id: c.id,
    name: c.name,
    bank: c.bank,
    last4: c.last4,
    currency: c.currency,
    closingDay: c.closingDay,
    dueDay: c.dueDay,
  }));
  const dialogCategories = categories.map((c) => ({ id: c.id, name: c.name }));
  // El manager de categorías usa además color/icon y el conteo de compras
  // asociadas (para avisar al borrar). No manda userId/createdAt.
  const managerCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    purchaseCount: c._count.purchases,
  }));

  // Cada lugar crea su propio elemento (función, no una constante reutilizada en
  // dos posiciones, que el serializador RSC tampoco resuelve bien).
  const renderNewPurchaseButton = () => (
    <PurchaseFormDialog
      cards={dialogCards}
      categories={dialogCategories}
      trigger={<Button>+ Nueva compra</Button>}
    />
  );

  const hasFilters = Boolean(sp.cardId || sp.categoryId || sp.currency || sp.month);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis compras</h1>
          <p className="text-muted-foreground text-sm">
            Registrá compras en cuotas y seguí sus vencimientos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CategoriesManagerDialog categories={managerCategories} />
          {cards.length > 0 && renderNewPurchaseButton()}
        </div>
      </header>

      {cards.length === 0 ? (
        // Sin tarjetas activas no se puede cargar una compra.
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <CreditCard className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Necesitás una tarjeta primero</p>
            <p className="text-muted-foreground text-sm">
              Agregá una tarjeta para empezar a registrar compras en cuotas.
            </p>
          </div>
          <Button asChild>
            <Link href="/tarjetas">Ir a mis tarjetas</Link>
          </Button>
        </div>
      ) : (
        <>
          <PurchaseFilters
            cards={cards.map((c) => ({ id: c.id, label: `${c.name} ···· ${c.last4}` }))}
            categories={categories.map((c) => ({ id: c.id, label: c.name }))}
            current={{
              cardId: sp.cardId,
              categoryId: sp.categoryId,
              currency: sp.currency,
              month: sp.month,
            }}
          />

          {purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <ShoppingBag className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {hasFilters
                    ? "No hay compras con esos filtros"
                    : "Todavía no registraste compras"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {hasFilters
                    ? "Probá ajustar o limpiar los filtros."
                    : "Cargá tu primera compra para ver el detalle de sus cuotas."}
                </p>
              </div>
              {!hasFilters && renderNewPurchaseButton()}
            </div>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tarjeta</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Cuotas</TableHead>
                    <TableHead className="text-right">Monto total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/compras/${p.id}`} className="hover:underline">
                          {p.description}
                        </Link>
                        {p.category && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            · {p.category.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.card.name} ···· {p.card.last4}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.purchaseDate)}
                      </TableCell>
                      <TableCell className="text-center">{p.totalInstallments}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(p.totalAmountCents, p.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
