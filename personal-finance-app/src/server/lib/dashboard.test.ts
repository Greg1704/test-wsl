import { describe, it, expect } from "vitest";
import { groupInstallmentsByDate } from "./dashboard";

describe("groupInstallmentsByDate", () => {
  // Fechas con componentes locales (new Date(año, mesIndex, día)) para no depender
  // de la TZ del runner.
  const row = (id: string, dueDate: Date) => ({ id, dueDate });

  it("agrupa por día de vencimiento y ordena cronológicamente", () => {
    const rows = [
      row("a", new Date(2026, 6, 20)),
      row("b", new Date(2026, 6, 10)),
      row("c", new Date(2026, 6, 10)),
    ];
    const groups = groupInstallmentsByDate(rows);

    expect(groups).toHaveLength(2);
    // El día 10 va antes que el 20, sin importar el orden de entrada.
    expect(groups[0].date.getDate()).toBe(10);
    expect(groups[0].items.map((i) => i.id)).toEqual(["b", "c"]);
    expect(groups[1].date.getDate()).toBe(20);
    expect(groups[1].items.map((i) => i.id)).toEqual(["a"]);
  });

  it("distingue el mismo día en meses distintos", () => {
    const groups = groupInstallmentsByDate([
      row("jul", new Date(2026, 6, 10)),
      row("ago", new Date(2026, 7, 10)),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("lista vacía → sin grupos", () => {
    expect(groupInstallmentsByDate([])).toEqual([]);
  });
});
