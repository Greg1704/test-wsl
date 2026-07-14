import { describe, it, expect } from "vitest";

import { categorySchema } from "./category";

describe("categorySchema.color (hardening anti-inyección CSS)", () => {
  it("acepta un hex válido de 6 dígitos (los presets de la UI)", () => {
    const parsed = categorySchema.parse({ name: "Viajes", color: "#3b82f6" });
    expect(parsed.color).toBe("#3b82f6");
  });

  it("acepta color ausente (opcional)", () => {
    const parsed = categorySchema.parse({ name: "Viajes" });
    expect(parsed.color).toBeUndefined();
  });

  it("rechaza un payload de inyección CSS (no es hex)", () => {
    // El color termina en un <style> vía dangerouslySetInnerHTML: un valor arbitrario
    // permitiría inyección CSS. La regla hex del server es el respaldo del selector.
    expect(() =>
      categorySchema.parse({ name: "Viajes", color: "red} html{display:none" })
    ).toThrow();
  });

  it("rechaza hex de 3 dígitos, sin '#' o con caracteres inválidos", () => {
    for (const color of ["#fff", "3b82f6", "#zzzzzz", "#3b82f6 "]) {
      expect(() => categorySchema.parse({ name: "Viajes", color })).toThrow();
    }
  });
});
