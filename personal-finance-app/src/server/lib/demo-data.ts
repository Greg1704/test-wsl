import { addMonths, startOfMonth, startOfToday } from "date-fns";

import type { PrismaClient } from "@/generated/prisma/client";
import { generateInstallments, impliedMonthlyRate } from "@/server/lib/installments";

/**
 * Prefijo del email de los usuarios demo efímeros. Cada visitante que toca
 * "Probar demo" recibe su PROPIO usuario (`demo-<random>@…`), sembrado con este
 * módulo y logueado al instante. El cron de limpieza (ver
 * src/app/api/cron/demo-cleanup) reapea por este prefijo. Mantenelo en sync con
 * el filtro del cron.
 */
export const DEMO_EMAIL_PREFIX = "demo-";
export const DEMO_EMAIL_DOMAIN = "demo.cuotapp.local";

/** ¿Es este un email de usuario demo efímero? Fuente única para action + cron. */
export function isDemoEmail(email: string): boolean {
  return email.startsWith(DEMO_EMAIL_PREFIX) && email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/**
 * Color por categoría para que el donut del dashboard se vea prolijo: las
 * categorías default las crea el hook post-signup SIN color y el donut solo tiene
 * 5 colores de fallback (se repetirían con 8 categorías). Acá le damos a cada una
 * un hex distinto. Las claves deben coincidir con DEFAULT_CATEGORIES.
 */
const CATEGORY_COLORS: Record<string, string> = {
  Indumentaria: "#f97316",
  Tecnología: "#3b82f6",
  Supermercado: "#22c55e",
  Servicios: "#a855f7",
  Salud: "#ef4444",
  Educación: "#14b8a6",
  Ocio: "#eab308",
  Otros: "#64748b",
};

/** Sólo lo que el seed necesita del cliente Prisma (facilita inyectar un fake). */
type DemoClient = Pick<
  PrismaClient,
  "card" | "category" | "purchase" | "installment" | "incomeEntry" | "savingsBalance" | "exchangeRate"
>;

/** Claves de las tarjetas de crédito que crea el seed (para referenciarlas en las compras). */
type CreditCardKey = "visa" | "master" | "naranja" | "amex";

/** Definición declarativa de una compra a crédito del demo. */
interface SeedCreditPurchase {
  card: CreditCardKey;
  description: string;
  merchant: string;
  categoryName: string;
  currency: "ARS" | "USD";
  /** Meses relativos a hoy: negativo = pasado (ya arrancó a pagarse). */
  monthsFromNow: number;
  totalInstallments: number;
  /** Monto original en centavos. */
  originalCents: bigint;
  /** Total financiado (con recargo) en centavos. Igual al original ⇒ sin interés. */
  financedCents: bigint;
}

/** Gasto de pago único (débito/transferencia/efectivo): descuenta del ahorro. */
interface SeedSinglePayment {
  description: string;
  merchant: string;
  categoryName: string;
  currency: "ARS" | "USD";
  monthsFromNow: number;
  paymentMethod: "DEBIT" | "TRANSFER" | "CASH";
  amountCents: bigint;
}

/**
 * Siembra un dataset realista y consolidado para un usuario demo. Está pensado para
 * que el DASHBOARD se vea completo apenas entra el visitante:
 * - 4 tarjetas de crédito (dos ARS/USD, dos ARS) + 1 de débito → la proyección a 12
 *   meses queda apilada por varias tarjetas y la vista multi-tarjeta luce.
 * - ~13 compras a crédito repartidas por categoría, tarjeta y mes → el donut "gasto
 *   del mes por categoría" muestra 6-7 porciones y la proyección tiene barras altas
 *   que se estiran a futuro (planes de 3 a 18 cuotas iniciados en distintos meses).
 * - Gastos de pago único del mes en varias categorías → el donut no-crédito también
 *   se llena.
 * - Ingreso mensual fechado y ancla de ahorro con montos significativos → los KPIs
 *   (disponible neto, % del ingreso, ahorro) dan cifras realistas y positivas.
 *
 * Todas las fechas son relativas a HOY, así el calendario y el dashboard siempre
 * muestran cuotas pasadas (pagadas) y futuras. Idempotencia: se asume `userId`
 * recién creado y vacío (el flujo demo lo garantiza); no borra nada previo.
 */
export async function seedDemoData(client: DemoClient, userId: string): Promise<void> {
  const today = startOfToday();
  const thisMonth = startOfMonth(today);

  // Categorías: las crea el hook post-signup de Better Auth. Las mapeamos por nombre
  // para adjuntarlas a las compras y, de paso, les pintamos un color para el donut.
  const categories = await client.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  await Promise.all(
    categories
      .filter((c) => CATEGORY_COLORS[c.name])
      .map((c) =>
        client.category.update({ where: { id: c.id }, data: { color: CATEGORY_COLORS[c.name] } })
      )
  );

  // ── Tarjetas ────────────────────────────────────────────────────────────────
  const cardData = [
    { key: "visa", name: "Visa Galicia", bank: "Galicia", brand: "Visa", last4: "4321", closingDay: 20, dueDay: 5, currencies: ["ARS", "USD"], expiresIn: 30 },
    { key: "master", name: "Mastercard Santander", bank: "Santander", brand: "Mastercard", last4: "8765", closingDay: 28, dueDay: 12, currencies: ["ARS"], expiresIn: 18 },
    { key: "naranja", name: "Naranja X", bank: "Naranja", brand: "Mastercard", last4: "3390", closingDay: 15, dueDay: 2, currencies: ["ARS"], expiresIn: 24 },
    { key: "amex", name: "Amex Galicia", bank: "Galicia", brand: "Amex", last4: "1007", closingDay: 22, dueDay: 8, currencies: ["ARS", "USD"], expiresIn: 36 },
  ] as const;

  const cards: Record<CreditCardKey, { id: string; closingDay: number; dueDay: number }> =
    {} as Record<CreditCardKey, { id: string; closingDay: number; dueDay: number }>;
  for (const c of cardData) {
    const created = await client.card.create({
      data: {
        userId,
        type: "CREDIT",
        name: c.name,
        bank: c.bank,
        brand: c.brand,
        last4: c.last4,
        closingDay: c.closingDay,
        dueDay: c.dueDay,
        currencies: [...c.currencies],
        expirationDate: addMonths(thisMonth, c.expiresIn),
      },
    });
    cards[c.key] = { id: created.id, closingDay: c.closingDay, dueDay: c.dueDay };
  }
  await client.card.create({
    data: {
      userId,
      type: "DEBIT",
      name: "Débito Galicia",
      bank: "Galicia",
      brand: "Visa",
      last4: "1122",
      currencies: ["ARS"],
    },
  });

  // ── Compras a crédito (generan cuotas) ───────────────────────────────────────
  // Repartidas por categoría, tarjeta y mes de compra. Las iniciadas en meses
  // pasados garantizan cuotas que vencen ESTE mes (llenan el donut); los planes
  // largos (12-18) estiran la proyección a futuro.
  const creditPurchases: SeedCreditPurchase[] = [
    { card: "visa", description: "Notebook Lenovo", merchant: "Fravega", categoryName: "Tecnología", currency: "ARS", monthsFromNow: -2, totalInstallments: 12, originalCents: 950_000_00n, financedCents: 1_140_000_00n },
    { card: "amex", description: "Smart TV 55\"", merchant: "Garbarino", categoryName: "Tecnología", currency: "ARS", monthsFromNow: -2, totalInstallments: 12, originalCents: 1_300_000_00n, financedCents: 1_560_000_00n },
    { card: "master", description: "Zapatillas running", merchant: "Dexter", categoryName: "Indumentaria", currency: "ARS", monthsFromNow: -1, totalInstallments: 3, originalCents: 240_000_00n, financedCents: 240_000_00n },
    { card: "naranja", description: "Campera de abrigo", merchant: "Montagne", categoryName: "Indumentaria", currency: "ARS", monthsFromNow: 0, totalInstallments: 3, originalCents: 180_000_00n, financedCents: 195_000_00n },
    { card: "naranja", description: "Tratamiento odontológico", merchant: "Clínica Dental", categoryName: "Salud", currency: "ARS", monthsFromNow: -1, totalInstallments: 6, originalCents: 300_000_00n, financedCents: 345_000_00n },
    { card: "visa", description: "Curso de inglés (anual)", merchant: "Wall Street English", categoryName: "Educación", currency: "ARS", monthsFromNow: -3, totalInstallments: 9, originalCents: 900_000_00n, financedCents: 1_050_000_00n },
    { card: "visa", description: "Bicicleta MTB", merchant: "Bike Store", categoryName: "Ocio", currency: "ARS", monthsFromNow: -1, totalInstallments: 6, originalCents: 600_000_00n, financedCents: 660_000_00n },
    { card: "master", description: "Muebles de living", merchant: "Sodimac", categoryName: "Otros", currency: "ARS", monthsFromNow: -4, totalInstallments: 18, originalCents: 2_400_000_00n, financedCents: 2_940_000_00n },
    { card: "master", description: "Heladera Samsung", merchant: "Musimundo", categoryName: "Otros", currency: "ARS", monthsFromNow: 0, totalInstallments: 6, originalCents: 850_000_00n, financedCents: 935_000_00n },
    { card: "naranja", description: "Plan de celular (12 cuotas)", merchant: "Movistar", categoryName: "Servicios", currency: "ARS", monthsFromNow: -2, totalInstallments: 12, originalCents: 480_000_00n, financedCents: 480_000_00n },
    // USD (segunda moneda: alimenta el toggle ARS/USD y su propio donut/proyección)
    { card: "visa", description: "Licencia anual software", merchant: "JetBrains", categoryName: "Tecnología", currency: "USD", monthsFromNow: -1, totalInstallments: 3, originalCents: 289_00n, financedCents: 289_00n },
    { card: "amex", description: "Auriculares Sony", merchant: "Amazon", categoryName: "Tecnología", currency: "USD", monthsFromNow: -1, totalInstallments: 3, originalCents: 210_00n, financedCents: 210_00n },
    { card: "amex", description: "Curso online (Udemy)", merchant: "Udemy", categoryName: "Educación", currency: "USD", monthsFromNow: 0, totalInstallments: 6, originalCents: 600_00n, financedCents: 660_00n },
  ];

  for (const p of creditPurchases) {
    const card = cards[p.card];
    const purchaseDate = addMonths(today, p.monthsFromNow);
    const rows = generateInstallments({
      cardClosingDay: card.closingDay,
      cardDueDay: card.dueDay,
      purchaseDate,
      totalInstallments: p.totalInstallments,
      totalAmountCents: p.financedCents,
      currency: p.currency,
    });
    const monthlyRate = impliedMonthlyRate(p.originalCents, p.financedCents, p.totalInstallments);

    const purchase = await client.purchase.create({
      data: {
        userId,
        paymentMethod: "CREDIT",
        cardId: card.id,
        categoryId: categoryId(p.categoryName),
        description: p.description,
        merchant: p.merchant,
        totalAmountCents: p.originalCents,
        currency: p.currency,
        totalInstallments: p.totalInstallments,
        purchaseDate,
        firstInstallmentDueDate: rows[0].dueDate,
        interestRateMonthly: monthlyRate > 0 ? monthlyRate : null,
      },
    });
    await client.installment.createMany({
      data: rows.map((row) => ({ ...row, purchaseId: purchase.id })),
    });
    // Realismo: las cuotas ya vencidas quedan marcadas como pagadas desde el ahorro
    // (así el calendario muestra historial y el ahorro "después de cuotas" cierra).
    await client.installment.updateMany({
      where: { purchaseId: purchase.id, dueDate: { lt: today } },
      data: { status: "PAID", paidAt: today, paidFromSavings: true },
    });
  }

  // ── Gastos de pago único (no-crédito) ────────────────────────────────────────
  // Varios de ESTE mes en distintas categorías → llenan el donut no-crédito.
  const singlePayments: SeedSinglePayment[] = [
    { description: "Compra mensual", merchant: "Coto", categoryName: "Supermercado", currency: "ARS", monthsFromNow: 0, paymentMethod: "DEBIT", amountCents: 320_000_00n },
    { description: "Alquiler", merchant: "Transferencia", categoryName: "Servicios", currency: "ARS", monthsFromNow: 0, paymentMethod: "TRANSFER", amountCents: 850_000_00n },
    { description: "Farmacia", merchant: "Farmacity", categoryName: "Salud", currency: "ARS", monthsFromNow: 0, paymentMethod: "DEBIT", amountCents: 45_000_00n },
    { description: "Nafta", merchant: "YPF", categoryName: "Otros", currency: "ARS", monthsFromNow: 0, paymentMethod: "DEBIT", amountCents: 120_000_00n },
    { description: "Streaming (Netflix + Spotify)", merchant: "Débito automático", categoryName: "Ocio", currency: "ARS", monthsFromNow: 0, paymentMethod: "DEBIT", amountCents: 28_000_00n },
    { description: "Cena de cumpleaños", merchant: "Efectivo", categoryName: "Ocio", currency: "ARS", monthsFromNow: -1, paymentMethod: "CASH", amountCents: 90_000_00n },
  ];

  for (const s of singlePayments) {
    const purchaseDate = addMonths(today, s.monthsFromNow);
    await client.purchase.create({
      data: {
        userId,
        paymentMethod: s.paymentMethod,
        // El débito referencia una tarjeta; transferencia/efectivo no. Para el demo
        // dejamos cardId null en todos (el débito sin tarjeta no rompe nada: el eje
        // de cuotas lee de Installment, que estos gastos no materializan).
        cardId: null,
        categoryId: categoryId(s.categoryName),
        description: s.description,
        merchant: s.merchant,
        totalAmountCents: s.amountCents,
        currency: s.currency,
        totalInstallments: 1,
        purchaseDate,
        firstInstallmentDueDate: purchaseDate,
      },
    });
  }

  // ── Ingreso mensual fechado (vigente desde hace 6 meses) ──────────────────────
  await client.incomeEntry.createMany({
    data: [
      { userId, currency: "ARS", amountCents: 3_200_000_00n, validFrom: addMonths(thisMonth, -6) },
      { userId, currency: "USD", amountCents: 800_00n, validFrom: addMonths(thisMonth, -6) },
    ],
  });

  // ── Ancla de ahorro (saldo declarado a inicio de este mes) ────────────────────
  await client.savingsBalance.createMany({
    data: [
      { userId, currency: "ARS", amountCents: 5_000_000_00n, asOf: thisMonth },
      { userId, currency: "USD", amountCents: 2_000_00n, asOf: thisMonth },
    ],
  });

  // ── Tipo de cambio USD→ARS (para vistas consolidadas) ─────────────────────────
  await client.exchangeRate.create({
    data: {
      userId,
      fromCurrency: "USD",
      toCurrency: "ARS",
      rate: 1150,
      validFrom: addMonths(thisMonth, -6),
    },
  });
}
