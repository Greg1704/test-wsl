import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { CategoriesManagerDialog } from "./categories-manager-dialog";
import * as actions from "@/server/actions/categories";

// Las Server Actions importan Prisma: las mockeamos para testear solo la UI.
vi.mock("@/server/actions/categories", () => ({
  createCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const categories = [
  { id: "c1", name: "Supermercado", color: "#22c55e", icon: "ShoppingBag", purchaseCount: 0 },
  { id: "c2", name: "Transporte", color: null, icon: null, purchaseCount: 5 },
];

function openDialog() {
  render(<CategoriesManagerDialog categories={categories} />);
  fireEvent.click(screen.getByRole("button", { name: "Categorías" }));
}

describe("CategoriesManagerDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista las categorías existentes al abrir", async () => {
    openDialog();
    expect(await screen.findByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it("valida que el nombre es requerido y no llama a createCategory", async () => {
    openDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Agregar categoría" }));
    expect(await screen.findByText("El nombre es requerido")).toBeInTheDocument();
    expect(actions.createCategory).not.toHaveBeenCalled();
  });

  it("crea una categoría al enviar el form con un nombre válido", async () => {
    openDialog();
    fireEvent.change(await screen.findByPlaceholderText("Supermercado"), {
      target: { value: "Salud" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar categoría" }));
    await waitFor(() =>
      expect(actions.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Salud" })
      )
    );
  });

  it("abre un modal de confirmación y al confirmar llama a deleteCategory", async () => {
    openDialog();
    // c1 (primera fila) no tiene compras asociadas → confirmación simple.
    const borrar = (await screen.findAllByRole("button", { name: "Borrar" }))[0];
    fireEvent.click(borrar);
    // El modal pide confirmación; todavía no se borró.
    expect(actions.deleteCategory).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/¿Querés eliminar la categoría «Supermercado»\?/)
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(actions.deleteCategory).toHaveBeenCalledWith("c1"));
  });

  it("avisa cuántas compras quedarán sin categoría al borrar una con compras", async () => {
    openDialog();
    // c2 tiene 5 compras asociadas: se muestra el conteo y el aviso en el modal.
    expect(await screen.findByText("5 compras")).toBeInTheDocument();
    const borrar = (await screen.findAllByRole("button", { name: "Borrar" }))[1];
    fireEvent.click(borrar);
    expect(
      await screen.findByText(/Hay 5 compras asociadas a «Transporte»/)
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(actions.deleteCategory).toHaveBeenCalledWith("c2"));
  });
});
