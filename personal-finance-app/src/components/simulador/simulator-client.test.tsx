import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SimulatorClient, type SimulatorClientProps } from "./simulator-client";

const baseProps: SimulatorClientProps = {
  cards: [
    {
      id: "card_visa",
      name: "Visa Galicia",
      bank: "Galicia",
      last4: "1234",
      currency: "ARS",
      closingDay: 20,
      dueDay: 10,
    },
  ],
  monthLabels: Array.from({ length: 61 }, (_, i) => `m${i}`),
  startYear: new Date().getFullYear(),
  startMonth: new Date().getMonth(),
  defaultCurrency: "ARS",
  income: 500000,
  baselines: [], // sin cuotas reales: el cliente sintetiza un baseline en cero
};

describe("SimulatorClient", () => {
  it("muestra el form y, sin inputs, invita a completarlo", () => {
    render(<SimulatorClient {...baseProps} />);
    expect(screen.getByRole("heading", { name: "Simulador" })).toBeInTheDocument();
    expect(screen.getByText("Monto total")).toBeInTheDocument();
    expect(
      screen.getByText(/Elegí una tarjeta y un monto para ver el impacto/)
    ).toBeInTheDocument();
  });

  it("al elegir tarjeta y monto, muestra el plan y la tabla de impacto", async () => {
    render(<SimulatorClient {...baseProps} />);

    // Abrir el select de tarjeta y elegir la única opción.
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: /Visa Galicia/ }));

    // Ingresar el monto (default = 3 cuotas).
    fireEvent.change(screen.getByLabelText("Monto total"), {
      target: { value: "30000" },
    });

    // Resumen del plan (misma función pura que el form de compra).
    expect(await screen.findByText(/3 cuotas de/)).toBeInTheDocument();
    // Aparece el detalle mes a mes (la tabla de impacto) con sus columnas.
    expect(screen.getByText("Detalle mes a mes")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Después" })).toBeInTheDocument();
  });

  it("activar 'Comparar' revela Plan A y Plan B", () => {
    render(<SimulatorClient {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Comparar con otro plan/ }));
    expect(screen.getByText("Plan A")).toBeInTheDocument();
    expect(screen.getByText("Plan B")).toBeInTheDocument();
    expect(screen.getByText(/Completá ambos planes/)).toBeInTheDocument();
  });

  it("con ambos planes completos, muestra la comparación A vs B", async () => {
    render(<SimulatorClient {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Comparar con otro plan/ }));

    // Plan A: tarjeta (combobox 0) + monto.
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: /Visa Galicia/ }));
    // Plan B: tarjeta (combobox 2) + monto.
    fireEvent.click(screen.getAllByRole("combobox")[2]);
    fireEvent.click(await screen.findByRole("option", { name: /Visa Galicia/ }));

    const amounts = screen.getAllByLabelText("Monto total");
    fireEvent.change(amounts[0], { target: { value: "30000" } });
    fireEvent.change(amounts[1], { target: { value: "60000" } });

    // Aparece la vista comparativa con la tabla de métricas.
    expect(await screen.findByText("Comparación")).toBeInTheDocument();
    expect(screen.getByText("Cuota mensual")).toBeInTheDocument();
    expect(screen.getByText("Total a pagar")).toBeInTheDocument();
  });
});
