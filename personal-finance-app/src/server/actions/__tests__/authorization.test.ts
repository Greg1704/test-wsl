import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: {
    card: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    purchase: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    installment: { createMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
    category: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  createCard,
  getCardById,
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
        name: "Visa Galicia",
        bank: "Galicia",
        last4: "1234",
        expiration: "08/27",
        closingDay: 20,
        dueDay: 10,
        currency: "ARS",
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
        name: "Visa Galicia",
        bank: "Galicia",
        last4: "1234",
        expiration: "08/27",
        closingDay: 20,
        dueDay: 10,
        currency: "ARS",
      });

      expect(result.status).toBe("duplicate");
      expect(vi.mocked(prisma.card.create)).not.toHaveBeenCalled();
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
