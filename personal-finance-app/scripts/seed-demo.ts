import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateInstallments } from "../src/server/lib/installments";
import { createDefaultCategoriesFor } from "../src/server/lib/categories";

/**
 * Datos de DEMO para DESARROLLO LOCAL: deja una cuenta con tarjetas, compras y
 * cuotas realistas (ARS + USD, pagadas/pendientes/vencidas) para ver el dashboard
 * "lleno" — charts de proyección, donut por categoría, KPIs — sin cargar todo a
 * mano. Pensado para screenshots y QA visual.
 *
 * ⚠️ DESTRUCTIVO con el usuario elegido: borra sus tarjetas y compras antes de
 * recrearlas. Usalo solo con una cuenta de prueba.
 *
 * Uso: TZ=UTC npx tsx scripts/seed-demo.ts [email]   (default: a@gmail.com)
 */

const DEMO_EMAIL = process.argv[2] ?? "a@gmail.com";

/** Compra de demo: el monto va en pesos/dólares "humanos" (se convierte a centavos). */
type DemoPurchase = {
  description: string;
  merchant: string;
  category: string;
  card: string;
  amount: number;
  installments: number;
  /** [año, mesIndex, día] para no depender de parsing de strings. */
  purchaseDate: [number, number, number];
  currency?: "ARS" | "USD";
};

const DEMO_CARDS = [
  // name, bank, last4, closingDay, dueDay, currency, vencimiento [año, mesIndex]
  { name: "Visa Galicia", bank: "Galicia", last4: "4321", closingDay: 28, dueDay: 10, currency: "ARS", exp: [2028, 7] },
  { name: "Master BBVA", bank: "BBVA", last4: "8810", closingDay: 22, dueDay: 5, currency: "ARS", exp: [2027, 10] },
  { name: "Amex Santander", bank: "Santander", last4: "0042", closingDay: 15, dueDay: 28, currency: "USD", exp: [2028, 2] },
] as const;

const DEMO_PURCHASES: DemoPurchase[] = [
  { description: "Heladera Samsung", merchant: "Frávega", category: "Tecnología", card: "Visa Galicia", amount: 1_439_988, installments: 12, purchaseDate: [2026, 1, 10] },
  { description: "Notebook Lenovo", merchant: "Mercado Libre", category: "Tecnología", card: "Master BBVA", amount: 2_246_000, installments: 18, purchaseDate: [2025, 11, 5] },
  { description: "Vuelos a Bariloche", merchant: "Aerolíneas", category: "Ocio", card: "Visa Galicia", amount: 654_000, installments: 6, purchaseDate: [2026, 0, 20] },
  { description: "Sillón living", merchant: "Sodimac", category: "Otros", card: "Master BBVA", amount: 820_000, installments: 12, purchaseDate: [2026, 2, 8] },
  { description: "Curso de inglés", merchant: "Instituto CUI", category: "Educación", card: "Visa Galicia", amount: 360_000, installments: 6, purchaseDate: [2026, 3, 15] },
  { description: "Zapatillas Nike", merchant: "Dexter", category: "Indumentaria", card: "Visa Galicia", amount: 189_900, installments: 3, purchaseDate: [2026, 4, 2] },
  { description: "Supermercado mensual", merchant: "Coto", category: "Supermercado", card: "Master BBVA", amount: 145_500, installments: 3, purchaseDate: [2026, 4, 20] },
  { description: "Lentes de contacto", merchant: "Óptica Lof", category: "Salud", card: "Visa Galicia", amount: 96_000, installments: 2, purchaseDate: [2026, 5, 1] },
  { description: "iPhone 15", merchant: "Apple", category: "Tecnología", card: "Amex Santander", amount: 999.99, installments: 9, purchaseDate: [2026, 2, 12], currency: "USD" },
  { description: "Hotel en Miami", merchant: "Booking", category: "Ocio", card: "Amex Santander", amount: 480, installments: 3, purchaseDate: [2026, 4, 10], currency: "USD" },
];

/** Cuotas de demo que se dejan VENCIDAS a propósito (badge de alerta del dashboard). */
const OVERDUE = new Set(["Sillón living"]);

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) throw new Error(`No existe un usuario con el email ${DEMO_EMAIL}`);

    // Limpieza previa (las cuotas caen por cascade) + ingreso, ahorro y moneda realistas.
    await prisma.purchase.deleteMany({ where: { userId: user.id } });
    await prisma.card.deleteMany({ where: { userId: user.id } });
    await prisma.incomeEntry.deleteMany({ where: { userId: user.id } });
    await prisma.savingsBalance.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultCurrency: "ARS" },
    });
    // Ingreso fechado (IncomeEntry): vigente desde un mes base anterior a las compras.
    const incomeFrom = new Date(2025, 0, 1);
    await prisma.incomeEntry.createMany({
      data: [
        { userId: user.id, currency: "ARS", amountCents: 2_400_000_00n, validFrom: incomeFrom },
        { userId: user.id, currency: "USD", amountCents: 1_500_00n, validFrom: incomeFrom },
      ],
    });
    // Saldo de ahorro inicial declarado por moneda (ancla del modelo SavingsBalance).
    const savingsAsOf = new Date(2025, 0, 1);
    await prisma.savingsBalance.createMany({
      data: [
        { userId: user.id, currency: "ARS", amountCents: 5_000_000_00n, asOf: savingsAsOf },
        { userId: user.id, currency: "USD", amountCents: 3_000_00n, asOf: savingsAsOf },
      ],
    });

    // Categorías por defecto si la cuenta no las tiene (cuentas pre-hook).
    const categoryCount = await prisma.category.count({ where: { userId: user.id } });
    if (categoryCount === 0) await createDefaultCategoriesFor(prisma, user.id);
    const categories = await prisma.category.findMany({ where: { userId: user.id } });
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

    const cardByName = new Map<string, { id: string; closingDay: number; dueDay: number }>();
    for (const c of DEMO_CARDS) {
      const card = await prisma.card.create({
        data: {
          userId: user.id,
          name: c.name,
          bank: c.bank,
          last4: c.last4,
          closingDay: c.closingDay,
          dueDay: c.dueDay,
          currencies: [c.currency],
          // Vencimiento de la tarjeta: fin de mes (convención del modelo).
          expirationDate: new Date(c.exp[0], c.exp[1] + 1, 0),
        },
      });
      cardByName.set(c.name, { id: card.id, closingDay: c.closingDay, dueDay: c.dueDay });
    }

    const today = new Date();
    let installmentCount = 0;

    for (const p of DEMO_PURCHASES) {
      const card = cardByName.get(p.card)!;
      const currency = p.currency ?? "ARS";
      const totalAmountCents = BigInt(Math.round(p.amount * 100));
      const purchaseDate = new Date(...p.purchaseDate);

      const rows = generateInstallments({
        cardClosingDay: card.closingDay,
        cardDueDay: card.dueDay,
        purchaseDate,
        totalInstallments: p.installments,
        totalAmountCents,
        currency,
      });

      // Compra + cuotas en una transacción (regla datos-y-prisma). Las cuotas ya
      // vencidas quedan PAID, salvo las marcadas para mostrar el estado "vencida".
      await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            userId: user.id,
            cardId: card.id,
            categoryId: categoryByName.get(p.category) ?? null,
            description: p.description,
            merchant: p.merchant,
            totalAmountCents,
            currency,
            totalInstallments: p.installments,
            purchaseDate,
            firstInstallmentDueDate: rows[0].dueDate,
          },
        });
        await tx.installment.createMany({
          data: rows.map((row) => {
            const isPast = row.dueDate < today;
            const markPaid = isPast && !OVERDUE.has(p.description);
            return {
              ...row,
              purchaseId: purchase.id,
              status: markPaid ? ("PAID" as const) : ("PENDING" as const),
              paidAt: markPaid ? row.dueDate : null,
            };
          }),
        });
      });
      installmentCount += rows.length;
    }

    console.log(
      `✓ Demo lista para ${DEMO_EMAIL}: ${DEMO_CARDS.length} tarjetas, ` +
        `${DEMO_PURCHASES.length} compras, ${installmentCount} cuotas (ARS + USD).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
