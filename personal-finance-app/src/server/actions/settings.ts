"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { incomeSchema } from "@/lib/validation/settings";
import { currencyToCents } from "@/server/lib/money";

/**
 * Configura el ingreso mensual y la moneda principal del usuario (RF-5.1). El
 * `userId` SIEMPRE viene de la sesión, nunca del input del cliente.
 */
export async function updateMonthlyIncome(input: unknown) {
  const user = await requireUser();
  const data = incomeSchema.parse(input);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      monthlyIncomeCents: currencyToCents(data.monthlyIncome),
      defaultCurrency: data.defaultCurrency,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/configuracion");
}
