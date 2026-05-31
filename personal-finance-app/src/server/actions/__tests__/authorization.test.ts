import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: {
    card: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    purchase: { create: vi.fn(), findFirst: vi.fn() },
    installment: { createMany: vi.fn() },
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
} from "@/server/actions/cards";
import { createPurchase, getPurchaseById } from "@/server/actions/purchases";

const USER_A = "user-aaaaaaaaaaaaaaaaaaaaaa";
const USER_B = "user-bbbbbbbbbbbbbbbbbbbbbb";
const CARD_OF_A = "cixf00000000000000000000";
const PURCHASE_OF_A = "cixf00000000000000000001";

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
      vi.mocked(prisma.card.updateMany).mockResolvedValue({ count: 0 } as never);

      await expect(deactivateCard(CARD_OF_A)).rejects.toThrow("no encontrada");
      expect(vi.mocked(prisma.card.updateMany)).toHaveBeenCalledWith({
        where: { id: CARD_OF_A, userId: USER_B },
        data: { isActive: false },
      });
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
  });
});
