import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: {
    card: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    purchase: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    installment: {
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    category: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), update: vi.fn() },
    incomeEntry: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    savingsBalance: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  createCard,
  getCardById,
  updateCard,
  deactivateCard,
  reactivateCard,
  renewCard,
} from "@/server/actions/cards";
import {
  createPurchase,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
} from "@/server/actions/purchases";
import { markInstallmentPaid, revertInstallment } from "@/server/actions/installments";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/server/actions/categories";
import {
  getMonthlyOverview,
  getNonCreditBreakdown,
  getOnboardingStatus,
  getSavingsOverview,
  getSavingsProjection,
  listInstallmentsByMonth,
} from "@/server/actions/dashboard";
import { updateMonthlyIncome, updateSavingsBalance } from "@/server/actions/settings";

const USER_A = "user-aaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "user-bbbbbbbbbbbbbbbbbbbbbb";
const CARD_OF_A = "cixf00000000000000000000";
const PURCHASE_OF_A = "cixf00000000000000000001";
const INSTALLMENT_OF_A = "cixf00000000000000000002";
const CATEGORY_OF_A = "cixf00000000000000000003";

function asUser(id: string) {
  vi.mocked(requireUser).mockResolvedValue({ id } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("autorización cross-user (RNF-1.1)", () => {
  describe("Card", () => {
    it("createCard escribe SIEMPRE el userId de la sesión, ignorando el del input", async () => {
      asUser(USER_B);
      vi.mocked(prisma.card.findFirst).mockResolvedValue(null); // sin duplicado
      vi.mocked(prisma.card.create).mockResolvedValue({ id: "new" } as never);

      await createCard({
        type: "CREDIT",
        name: "Visa Galicia",
        bank: "Galicia",
        last4: "1234",
        expiration: "08/27",
        closingDay: 20,
        dueDay: 10,
        currencies: ["ARS"],
        userId: USER_A, // intento malicioso: debe ser ignorado
      });

      const arg = vi.mocked(prisma.card.create).mock.calls[0][0] as {
        data: { userId: string };
      };
      expect(arg.data.userId).toBe(USER_B);
    });

    it("createCard detecta duplicado (banco + last4) y NO crea", async () => {
      asUser(USER_B);
      vi.mocked(prisma.card.create).mockClear();
      vi.mocked(prisma.card.findFirst).mockResolvedValue({
        id: "existing",
        isActive: false,
      } as never);

      const result = await createCard({
        type: "CREDIT",
        name: "Visa Galicia",
        bank: "Galicia",
        last4: "1234",
        expiration: "08/27",
        closingDay: 20,
        dueDay: 10,
        currencies: ["ARS"],
      });

      expect(result.status).toBe("duplicate");
      expect(vi.mocked(prisma.card.create)).not.toHaveBeenCalled();
    });

    it("updateCard bloquea quitar una moneda con cuotas pendientes en esa moneda", async () => {
      asUser(USER_A);
      vi.mocked(prisma.card.findFirst).mockResolvedValue({
        id: CARD_OF_A,
        currencies: ["ARS", "USD"],
      } as never);
      // Quedan cuotas pendientes en ARS: no se puede sacar ARS.
      vi.mocked(prisma.installment.groupBy).mockResolvedValue([
        { currency: "ARS", _count: { _all: 3 } },
      ] as never);

      await expect(
        updateCard(CARD_OF_A, {
          type: "CREDIT",
          name: "Visa Galicia",
          bank: "Galicia",
          last4: "1234",
          expiration: "08/30",
          closingDay: 20,
          dueDay: 10,
          currencies: ["USD"], // se quita ARS
        })
      ).rejects.toThrow(/pendiente/i);
      // El conteo va scopeado por userId y por la moneda removida.
      expect(vi.mocked(prisma.installment.groupBy)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: "PAID" },
            currency: { in: ["ARS"] },
            purchase: { cardId: CARD_OF_A, userId: USER_A },
          }),
        })
      );
      expect(vi.mocked(prisma.card.updateMany)).not.toHaveBeenCalled();
    });

    it("updateCard permite quitar una moneda sin cuotas pendientes", async () => {
      asUser(USER_A);
      vi.mocked(prisma.card.findFirst).mockResolvedValue({
        id: CARD_OF_A,
        currencies: ["ARS", "USD"],
      } as never);
      vi.mocked(prisma.installment.groupBy).mockResolvedValue([] as never);
      vi.mocked(prisma.card.updateMany).mockResolvedValue({ count: 1 } as never);

      await updateCard(CARD_OF_A, {
        type: "CREDIT",
        name: "Visa Galicia",
        bank: "Galicia",
        last4: "1234",
        expiration: "08/30",
        closingDay: 20,
        dueDay: 10,
        currencies: ["USD"],
      });
      expect(vi.mocked(prisma.card.updateMany)).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CARD_OF_A, userId: USER_A } })
      );
    });

    it("getCardById de B no puede leer una tarjeta de A (query scopeada al userId de sesión)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.card.findFirst).mockResolvedValue(null);

      await expect(getCardById(CARD_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.card.findFirst)).toHaveBeenCalledWith({
        where: { id: CARD_OF_A, userId: USER_B },
      });
    });

    it("deactivateCard de B no desactiva una tarjeta de A (count 0 → error)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.installment.count).mockResolvedValue(0);
      vi.mocked(prisma.card.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(deactivateCard(CARD_OF_A)).rejects.toThrow("no encontrada");
      // El conteo de cuotas pendientes va scopeado por userId vía la relación.
      expect(vi.mocked(prisma.installment.count)).toHaveBeenCalledWith({
        where: { status: { not: "PAID" }, purchase: { cardId: CARD_OF_A, userId: USER_B } },
      });
      expect(vi.mocked(prisma.card.updateMany)).toHaveBeenCalledWith({
        where: { id: CARD_OF_A, userId: USER_B },
        data: { isActive: false },
      });
    });

    it("deactivateCard no desactiva una tarjeta con cuotas pendientes (problema reportado)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.installment.count).mockResolvedValue(4);

      await expect(deactivateCard(CARD_OF_A)).rejects.toThrow("pendiente");
      // No debe intentar el update si hay cuotas sin pagar.
      expect(vi.mocked(prisma.card.updateMany)).not.toHaveBeenCalled();
    });

    it("reactivateCard de B no reactiva una tarjeta de A (count 0 → error)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.card.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(reactivateCard(CARD_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.card.updateMany)).toHaveBeenCalledWith({
        where: { id: CARD_OF_A, userId: USER_B },
        data: { isActive: true },
      });
    });

    it("renewCard de B no renueva una tarjeta de A (scopeado por userId)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.card.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(renewCard(CARD_OF_A, { expiration: "12/40" })).rejects.toThrow(
        "no encontrada"
      );
      expect(vi.mocked(prisma.card.updateMany)).toHaveBeenCalledWith({
        where: { id: CARD_OF_A, userId: USER_B },
        data: { expirationDate: expect.any(Date) },
      });
    });

    it("renewCard rechaza un vencimiento no futuro (no toca la DB)", async () => {
      asUser(USER_B);

      await expect(renewCard(CARD_OF_A, { expiration: "01/20" })).rejects.toThrow();
      expect(vi.mocked(prisma.card.updateMany)).not.toHaveBeenCalled();
    });
  });

  describe("Purchase", () => {
    it("createPurchase de B sobre una tarjeta de A es rechazada y no abre la transacción", async () => {
      asUser(USER_B);
      vi.mocked(prisma.card.findFirst).mockResolvedValue(null);

      await expect(
        createPurchase({
          paymentMethod: "CREDIT",
          cardId: CARD_OF_A,
          description: "Notebook",
          totalAmount: 1000,
          currency: "ARS",
          totalInstallments: 6,
          purchaseDate: new Date(2025, 0, 15),
        })
      ).rejects.toThrow("Tarjeta no encontrada");

      expect(vi.mocked(prisma.card.findFirst)).toHaveBeenCalledWith({
        where: { id: CARD_OF_A, userId: USER_B },
      });
      expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    });

    it("createPurchase de un gasto en efectivo no abre transacción ni crea cuotas", async () => {
      asUser(USER_A);
      vi.mocked(prisma.purchase.create).mockResolvedValue({ id: "p-cash" } as never);

      await createPurchase({
        paymentMethod: "CASH",
        description: "Feria",
        totalAmount: 5000,
        currency: "ARS",
        totalInstallments: 1,
        purchaseDate: new Date(2026, 0, 15),
      });

      // Pago único: sin tarjeta, sin cuotas materializadas, con el userId de la sesión.
      expect(vi.mocked(prisma.purchase.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_A,
            paymentMethod: "CASH",
            cardId: null,
            totalInstallments: 1,
            interestRateMonthly: null,
          }),
        })
      );
      expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
      expect(vi.mocked(prisma.installment.createMany)).not.toHaveBeenCalled();
    });

    it("createPurchase con débito rechaza una tarjeta de crédito (tipo inválido)", async () => {
      asUser(USER_A);
      vi.mocked(prisma.card.findFirst).mockResolvedValue({
        id: CARD_OF_A,
        type: "CREDIT",
        currencies: ["ARS"],
      } as never);

      await expect(
        createPurchase({
          paymentMethod: "DEBIT",
          cardId: CARD_OF_A,
          description: "Súper",
          totalAmount: 100,
          currency: "ARS",
          totalInstallments: 1,
          purchaseDate: new Date(2026, 0, 15),
        })
      ).rejects.toThrow("Tipo de tarjeta inválido");
      expect(vi.mocked(prisma.purchase.create)).not.toHaveBeenCalled();
    });

    it("createPurchase rechaza una moneda que la tarjeta no opera (no abre transacción)", async () => {
      asUser(USER_A);
      // Tarjeta que solo opera ARS; la compra pide USD.
      vi.mocked(prisma.card.findFirst).mockResolvedValue({
        id: CARD_OF_A,
        type: "CREDIT",
        currencies: ["ARS"],
        closingDay: 20,
        dueDay: 10,
      } as never);

      await expect(
        createPurchase({
          paymentMethod: "CREDIT",
          cardId: CARD_OF_A,
          description: "Compra en dólares",
          totalAmount: 100,
          currency: "USD",
          totalInstallments: 3,
          purchaseDate: new Date(2026, 0, 15),
        })
      ).rejects.toThrow("no opera en esa moneda");
      expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    });

    it("getPurchaseById de B no puede leer una compra de A", async () => {
      asUser(USER_B);
      vi.mocked(prisma.purchase.findFirst).mockResolvedValue(null);

      await expect(getPurchaseById(PURCHASE_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.purchase.findFirst)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_B }),
        })
      );
    });

    it("updatePurchase de B no edita una compra de A (count 0 → error)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.purchase.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(
        updatePurchase(PURCHASE_OF_A, { description: "Hackeada" })
      ).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.purchase.updateMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PURCHASE_OF_A, userId: USER_B },
        })
      );
    });

    it("deletePurchase de B no borra una compra de A (count 0 → error)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.purchase.deleteMany).mockResolvedValue({ count: 0 } as never);

      await expect(deletePurchase(PURCHASE_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.purchase.deleteMany)).toHaveBeenCalledWith({
        where: { id: PURCHASE_OF_A, userId: USER_B },
      });
    });
  });

  describe("Installment", () => {
    it("markInstallmentPaid de B no toca una cuota de A (autoriza vía purchase.userId)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.installment.findFirst).mockResolvedValue(null);

      await expect(markInstallmentPaid(INSTALLMENT_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.installment.findFirst)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: INSTALLMENT_OF_A, purchase: { userId: USER_B } },
        })
      );
      // Si no es del usuario, nunca se ejecuta el update.
      expect(vi.mocked(prisma.installment.update)).not.toHaveBeenCalled();
    });

    it("revertInstallment de B no toca una cuota de A", async () => {
      asUser(USER_B);
      vi.mocked(prisma.installment.findFirst).mockResolvedValue(null);

      await expect(revertInstallment(INSTALLMENT_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.installment.update)).not.toHaveBeenCalled();
    });
  });

  describe("Category", () => {
    it("createCategory escribe SIEMPRE el userId de la sesión", async () => {
      asUser(USER_B);
      vi.mocked(prisma.category.findFirst).mockResolvedValue(null); // sin duplicado
      vi.mocked(prisma.category.create).mockResolvedValue({ id: "new" } as never);

      await createCategory({ name: "Viajes", userId: USER_A });

      const arg = vi.mocked(prisma.category.create).mock.calls[0][0] as {
        data: { userId: string };
      };
      expect(arg.data.userId).toBe(USER_B);
    });

    it("updateCategory de B no edita una categoría de A (count 0 → error)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.category.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(
        updateCategory(CATEGORY_OF_A, { name: "Robada" })
      ).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.category.updateMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CATEGORY_OF_A, userId: USER_B },
        })
      );
    });

    it("deleteCategory de B no borra una categoría de A (count 0 → error)", async () => {
      asUser(USER_B);
      vi.mocked(prisma.category.deleteMany).mockResolvedValue({ count: 0 } as never);

      await expect(deleteCategory(CATEGORY_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.category.deleteMany)).toHaveBeenCalledWith({
        where: { id: CATEGORY_OF_A, userId: USER_B },
      });
    });
  });
});

describe("dashboard y configuración (Fase 3)", () => {
  const USER = USER_A;

  it("updateMonthlyIncome escribe SIEMPRE el userId de la sesión (User + IncomeEntry)", async () => {
    asUser(USER);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.incomeEntry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.incomeEntry.create).mockResolvedValue({} as never);

    await updateMonthlyIncome({ defaultCurrency: "ARS", incomeArs: 1_500_000 });

    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith({
      where: { id: USER },
      data: { defaultCurrency: "ARS" },
    });
    // La entrada de ingreso del mes se crea con el userId de la sesión y en ARS.
    expect(vi.mocked(prisma.incomeEntry.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER,
          currency: "ARS",
          amountCents: 150_000_000n,
        }),
      })
    );
  });

  it("updateMonthlyIncome rechaza un ingreso negativo (no toca la DB)", async () => {
    asUser(USER);

    await expect(
      updateMonthlyIncome({ defaultCurrency: "ARS", incomeArs: -1 })
    ).rejects.toThrow();
    expect(vi.mocked(prisma.user.update)).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.incomeEntry.create)).not.toHaveBeenCalled();
  });

  it("getMonthlyOverview scopea por userId; neto en las monedas con ingreso configurado", async () => {
    asUser(USER);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      defaultCurrency: "ARS",
    } as never);
    // Ingreso solo en ARS (la moneda principal); USD sin entrada → sin neto.
    vi.mocked(prisma.incomeEntry.findMany).mockResolvedValue([
      { currency: "ARS", amountCents: 1000n, validFrom: new Date("2026-01-01") },
    ] as never);
    vi.mocked(prisma.installment.groupBy).mockResolvedValue([
      { currency: "ARS", _sum: { amountCents: 300n } },
      { currency: "USD", _sum: { amountCents: 50n } },
    ] as never);
    vi.mocked(prisma.installment.count).mockResolvedValue(2);
    vi.mocked(prisma.installment.findFirst).mockResolvedValue(null);

    const overview = await getMonthlyOverview(new Date("2026-06-15"));

    // El groupBy va scopeado por el userId vía la relación purchase.
    expect(vi.mocked(prisma.installment.groupBy)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ purchase: { userId: USER } }),
      })
    );
    // El ingreso se lee scopeado por el userId de sesión.
    expect(vi.mocked(prisma.incomeEntry.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER } })
    );
    const ars = overview.currencies.find((c) => c.currency === "ARS")!;
    const usd = overview.currencies.find((c) => c.currency === "USD")!;
    expect(ars.committedCents).toBe(300n);
    expect(ars.netCents).toBe(700n); // 1000 − 300
    expect(usd.netCents).toBeNull(); // USD sin ingreso configurado → sin neto
    expect(overview.overdueCount).toBe(2);
  });

  it("updateSavingsBalance escribe el ancla SIEMPRE con el userId de la sesión", async () => {
    asUser(USER);
    vi.mocked(prisma.savingsBalance.upsert).mockResolvedValue({} as never);

    await updateSavingsBalance({ savingsArs: 5000 });

    expect(vi.mocked(prisma.savingsBalance.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_currency: { userId: USER, currency: "ARS" } },
      })
    );
  });

  it("getSavingsOverview lee gastos no-crédito y ancla scopeados por el userId de sesión", async () => {
    asUser(USER);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ defaultCurrency: "ARS" } as never);
    vi.mocked(prisma.savingsBalance.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.incomeEntry.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.purchase.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.installment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.installment.groupBy).mockResolvedValue([] as never);

    const result = await getSavingsOverview(new Date("2026-06-15"));

    expect(vi.mocked(prisma.savingsBalance.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER } })
    );
    // Los gastos que descuentan del ahorro son los no-crédito, scopeados por userId.
    expect(vi.mocked(prisma.purchase.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, paymentMethod: { in: ["DEBIT", "TRANSFER", "CASH"] } },
      })
    );
    // Siempre devuelve al menos la moneda principal.
    expect(result.currencies[0].currency).toBe("ARS");
  });

  it("getSavingsProjection scopea ancla, ingreso y gastos por el userId de sesión", async () => {
    asUser(USER);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ defaultCurrency: "ARS" } as never);
    vi.mocked(prisma.savingsBalance.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.incomeEntry.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.purchase.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.installment.findMany).mockResolvedValue([] as never);

    const series = await getSavingsProjection(new Date("2026-06-15"), 12);

    expect(vi.mocked(prisma.savingsBalance.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER } })
    );
    expect(vi.mocked(prisma.purchase.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, paymentMethod: { in: ["DEBIT", "TRANSFER", "CASH"] } },
      })
    );
    // Sin datos: la serie de la moneda principal trae 12 meses en cero.
    expect(series[0].currency).toBe("ARS");
    expect(series[0].months).toHaveLength(12);
  });

  it("getNonCreditBreakdown scopea las compras no-crédito por el userId de sesión", async () => {
    asUser(USER);
    vi.mocked(prisma.purchase.findMany).mockResolvedValue([] as never);

    await getNonCreditBreakdown(new Date("2026-06-15"));

    expect(vi.mocked(prisma.purchase.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER,
          paymentMethod: { in: ["DEBIT", "TRANSFER", "CASH"] },
        }),
      })
    );
  });

  it("listInstallmentsByMonth scopea por el userId de sesión", async () => {
    asUser(USER);
    vi.mocked(prisma.installment.findMany).mockResolvedValue([] as never);

    await listInstallmentsByMonth(new Date("2026-06-15"));

    expect(vi.mocked(prisma.installment.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ purchase: { userId: USER } }),
      })
    );
  });

  it("getOnboardingStatus cuenta tarjetas/compras scopeadas por el userId de sesión", async () => {
    asUser(USER);
    vi.mocked(prisma.incomeEntry.count).mockResolvedValue(0);
    vi.mocked(prisma.card.count).mockResolvedValue(1);
    vi.mocked(prisma.purchase.count).mockResolvedValue(0);

    const status = await getOnboardingStatus();

    expect(vi.mocked(prisma.incomeEntry.count)).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(vi.mocked(prisma.card.count)).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(vi.mocked(prisma.purchase.count)).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(status).toEqual({ hasIncome: false, hasCards: true, hasPurchases: false });
  });
});
