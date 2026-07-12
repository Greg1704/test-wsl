"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { incomeSchema, savingsSchema } from "@/lib/validation/settings";
import { currencyToCents } from "@/server/lib/money";
import { startOfMonth } from "@/server/lib/dates";

/**
 * Inserta o actualiza la entrada de ingreso del MES ACTUAL para una moneda
 * (modelo `IncomeEntry`, fechado por vigencia). Re-guardar el mismo mes pisa el
 * valor; los meses pasados quedan congelados en sus propias entradas. El `userId`
 * SIEMPRE viene de la sesión.
 */
async function upsertCurrentMonthIncome(userId: string, currency: string, amountCents: bigint) {
  const validFrom = startOfMonth(new Date());
  const existing = await prisma.incomeEntry.findFirst({
    where: { userId, currency, validFrom },
    select: { id: true },
  });
  if (existing) {
    await prisma.incomeEntry.update({ where: { id: existing.id }, data: { amountCents } });
  } else {
    await prisma.incomeEntry.create({ data: { userId, currency, amountCents, validFrom } });
  }
}

/**
 * Configura la moneda principal y el ingreso mensual por moneda (RF-5.1). El ingreso
 * se guarda como entrada fechada del mes actual; las monedas sin valor no se tocan.
 */
export async function updateMonthlyIncome(input: unknown) {
  const user = await requireUser();
  const data = incomeSchema.parse(input);

  await prisma.user.update({
    where: { id: user.id },
    data: { defaultCurrency: data.defaultCurrency },
  });

  if (data.incomeArs != null) {
    await upsertCurrentMonthIncome(user.id, "ARS", currencyToCents(data.incomeArs));
  }
  if (data.incomeUsd != null) {
    await upsertCurrentMonthIncome(user.id, "USD", currencyToCents(data.incomeUsd));
  }

  revalidatePath("/dashboard");
  revalidatePath("/configuracion");
}

/**
 * Declara/actualiza el saldo de ahorro actual por moneda (ancla `SavingsBalance`).
 * Re-ancla el saldo al mes actual; las monedas sin valor no se tocan. Scopeado por
 * el `userId` de sesión.
 */
export async function updateSavingsBalance(input: unknown) {
  const user = await requireUser();
  const data = savingsSchema.parse(input);
  // El ancla es el saldo declarado en ESTE instante (timestamp, no medianoche): así las
  // cuotas/gastos anteriores al guardado caen del lado "ya reflejado en el saldo" y no se
  // vuelven a descontar, y solo lo posterior lo hace. Ver docs/ARCHITECTURE.md → Ahorros.
  const asOf = new Date();

  // Saldos actuales por moneda: solo re-anclamos (y refrescamos `asOf`) las monedas cuyo
  // monto CAMBIÓ. Así "última actualización" es significativa por moneda (guardar ARS no
  // toca la fecha de USD si el USD no cambió).
  const existing = await prisma.savingsBalance.findMany({
    where: { userId: user.id },
    select: { currency: true, amountCents: true },
  });
  const currentByCurrency = new Map(existing.map((r) => [r.currency, r.amountCents]));

  const upsertIfChanged = (currency: string, amountCents: bigint) => {
    if (currentByCurrency.get(currency) === amountCents) return null; // sin cambios: no re-ancla
    return prisma.savingsBalance.upsert({
      where: { userId_currency: { userId: user.id, currency } },
      create: { userId: user.id, currency, amountCents, asOf },
      update: { amountCents, asOf },
    });
  };

  const writes = [
    data.savingsArs != null ? upsertIfChanged("ARS", currencyToCents(data.savingsArs)) : null,
    data.savingsUsd != null ? upsertIfChanged("USD", currencyToCents(data.savingsUsd)) : null,
  ].filter((w) => w !== null);
  await Promise.all(writes);

  revalidatePath("/dashboard");
  revalidatePath("/configuracion");
}

/**
 * Activa/desactiva el opt-in al mail mensual de deudas (`User.monthlyReportEnabled`).
 * El `userId` SIEMPRE viene de la sesión (nunca del cliente). Lo lee el cron
 * `/api/cron/monthly-report` para decidir a quién mandarle el reporte.
 */
export async function setMonthlyReportEnabled(input: unknown) {
  const user = await requireUser();
  const enabled = z.boolean().parse(input);

  await prisma.user.update({
    where: { id: user.id },
    data: { monthlyReportEnabled: enabled },
  });

  revalidatePath("/configuracion");
}

/**
 * Activa/desactiva el seguimiento de límite de crédito + utilización
 * (`User.trackCreditLimits`). Apagado ⇒ no se muestran límites, barras ni alertas, y las
 * compras no piden cotización. El `userId` SIEMPRE viene de la sesión. Revalida las vistas
 * que dependen del flag (config, tarjetas, dashboard).
 */
export async function setTrackCreditLimits(input: unknown) {
  const user = await requireUser();
  const enabled = z.boolean().parse(input);

  await prisma.user.update({
    where: { id: user.id },
    data: { trackCreditLimits: enabled },
  });

  revalidatePath("/configuracion");
  revalidatePath("/tarjetas");
  revalidatePath("/dashboard");
}
