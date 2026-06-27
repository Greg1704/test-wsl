import { prisma } from "@/server/db";
import { monthRange, startOfToday } from "@/server/lib/dates";
import { incomeForMonth, type IncomeEntryInput } from "@/server/lib/savings";

/** Resumen de una moneda para el mes (RF-5.1). `income`/`net` solo en la principal. */
export type CurrencyOverview = {
  currency: string;
  committedCents: bigint;
  nextDue: { dueDate: Date; amountCents: bigint } | null;
  incomeCents: bigint | null;
  netCents: bigint | null;
};

export type MonthlyOverview = {
  defaultCurrency: string;
  hasIncome: boolean;
  overdueCount: number;
  currencies: CurrencyOverview[];
};

/**
 * Resumen del dashboard para un mes (RF-5), por `userId` explícito (SIN sesión): por
 * cada moneda, total comprometido (todas las cuotas que vencen ese mes), próximo
 * vencimiento y —solo en la moneda principal— ingreso y disponible neto. Más el conteo
 * global de cuotas vencidas.
 *
 * Vive fuera de las Server Actions a propósito: lo consumen tanto el dashboard (vía la
 * action `getMonthlyOverview`, que le pasa el userId de sesión) como el cron del reporte
 * mensual (que itera usuarios sin sesión). Mantenerlo acá evita exponer un endpoint que
 * reciba un userId arbitrario del cliente.
 */
export async function getMonthlyOverviewForUser(
  userId: string,
  month: Date
): Promise<MonthlyOverview> {
  const { gte, lt } = monthRange(month);

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultCurrency: true },
  });
  const defaultCurrency = profile?.defaultCurrency ?? "ARS";

  // Ingreso fechado por moneda (modelo IncomeEntry): el del mes navegado es la entrada
  // vigente (mayor validFrom <= mes). Agrupamos por moneda en memoria.
  const incomeRows = await prisma.incomeEntry.findMany({
    where: { userId },
    select: { currency: true, amountCents: true, validFrom: true },
  });
  const incomeByCurrency = new Map<string, IncomeEntryInput[]>();
  for (const r of incomeRows) {
    const list = incomeByCurrency.get(r.currency) ?? [];
    list.push({ amountCents: r.amountCents, validFrom: r.validFrom });
    incomeByCurrency.set(r.currency, list);
  }
  const incomeForCurrency = (currency: string): bigint | null => {
    const entries = incomeByCurrency.get(currency);
    return entries ? incomeForMonth(entries, month) : null;
  };

  // Total comprometido por moneda (cuotas que vencen en el mes, pagas o no).
  const grouped = await prisma.installment.groupBy({
    by: ["currency"],
    where: { dueDate: { gte, lt }, purchase: { userId } },
    _sum: { amountCents: true },
  });
  const committedByCurrency = new Map<string, bigint>();
  for (const g of grouped) {
    committedByCurrency.set(g.currency, g._sum.amountCents ?? 0n);
  }

  // Cuotas vencidas: impagas con vencimiento anterior a hoy (badge de alerta, RF-5.2).
  const overdueCount = await prisma.installment.count({
    where: {
      status: "PENDING",
      dueDate: { lt: startOfToday() },
      purchase: { userId },
    },
  });

  // Monedas a mostrar: la principal siempre, más cualquiera con cuotas en el mes.
  const currencySet = new Set<string>([defaultCurrency, ...committedByCurrency.keys()]);

  const currencies: CurrencyOverview[] = [];
  for (const currency of currencySet) {
    const committedCents = committedByCurrency.get(currency) ?? 0n;
    const nextDue = await prisma.installment.findFirst({
      where: {
        currency,
        status: "PENDING",
        dueDate: { gte: startOfToday() },
        purchase: { userId },
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true, amountCents: true },
    });
    const income = incomeForCurrency(currency);
    currencies.push({
      currency,
      committedCents,
      nextDue,
      incomeCents: income,
      netCents: income !== null ? income - committedCents : null,
    });
  }

  // La moneda principal va primero.
  currencies.sort((a, b) =>
    a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : 0
  );

  const defaultIncome = incomeForCurrency(defaultCurrency) ?? 0n;
  return { defaultCurrency, hasIncome: defaultIncome > 0n, overdueCount, currencies };
}
