import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getPurchaseById } from "@/server/actions/purchases";
import { listCategories } from "@/server/actions/categories";
import { formatMoney } from "@/server/lib/money";
import { formatDate } from "@/server/lib/dates";
import { computeDisplayStatus } from "@/server/lib/installment-status";
import { Button } from "@/components/ui/button";
import {
  InstallmentList,
  type InstallmentView,
} from "@/components/compras/installment-list";
import { EditPurchaseDialog } from "@/components/compras/edit-purchase-dialog";
import { DeletePurchaseButton } from "@/components/compras/delete-purchase-button";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [purchase, categories] = await Promise.all([
    getPurchaseById(id).catch(() => null),
    listCategories(),
  ]);

  if (!purchase) notFound();

  // DTO de cuotas: estado computado (OVERDUE) y montos formateados en el server,
  // así no cruza ningún BigInt hacia el cliente.
  const installments: InstallmentView[] = purchase.installments.map((inst) => ({
    id: inst.id,
    installmentNumber: inst.installmentNumber,
    amount: formatMoney(inst.amountCents, inst.currency),
    dueDate: formatDate(inst.dueDate),
    status: computeDisplayStatus(inst.status, inst.dueDate),
    paidAt: inst.paidAt ? formatDate(inst.paidAt) : null,
  }));

  const paidCount = installments.filter((i) => i.status === "PAID").length;

  // El total financiado = suma de las cuotas (que reparten el total con recargo).
  // El recargo se deriva contra el monto original; la TEM la guardamos al crear.
  const financedCents = purchase.installments.reduce((acc, i) => acc + i.amountCents, 0n);
  const hasSurcharge = financedCents > purchase.totalAmountCents;
  const surchargePct = hasSurcharge
    ? (Number(financedCents) / Number(purchase.totalAmountCents) - 1) * 100
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/compras">
            <ArrowLeft className="mr-1 size-4" />
            Volver a compras
          </Link>
        </Button>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {purchase.description}
          </h1>
          <p className="text-muted-foreground text-sm">
            {purchase.card.name} ···· {purchase.card.last4} ·{" "}
            {formatDate(purchase.purchaseDate)}
            {purchase.category && <> · {purchase.category.name}</>}
            {purchase.merchant && <> · {purchase.merchant}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EditPurchaseDialog
            purchaseId={purchase.id}
            categories={categories}
            initial={{
              description: purchase.description,
              categoryId: purchase.categoryId ?? undefined,
              merchant: purchase.merchant ?? undefined,
              notes: purchase.notes ?? undefined,
            }}
            trigger={
              <Button variant="outline" size="sm">
                Editar
              </Button>
            }
          />
          <DeletePurchaseButton purchaseId={purchase.id} />
        </div>
      </header>

      <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">
            {hasSurcharge ? "Monto original" : "Monto total"}
          </p>
          <p className="text-lg font-semibold">
            {formatMoney(purchase.totalAmountCents, purchase.currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Total a pagar</p>
          <p className="text-lg font-semibold">
            {formatMoney(financedCents, purchase.currency)}
          </p>
          {hasSurcharge && (
            <p className="text-muted-foreground text-xs">
              Recargo +{surchargePct.toFixed(1)}%
              {purchase.interestRateMonthly
                ? ` · TEM ≈ ${Number(purchase.interestRateMonthly).toFixed(1)}%/mes`
                : ""}
            </p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Cuotas</p>
          <p className="text-lg font-semibold">
            {paidCount}/{purchase.totalInstallments} pagas
          </p>
        </div>
      </section>

      {purchase.notes && (
        <p className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">Notas:</span> {purchase.notes}
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Cuotas</h2>
        <InstallmentList
          installments={installments}
          total={purchase.totalInstallments}
        />
      </section>
    </main>
  );
}
