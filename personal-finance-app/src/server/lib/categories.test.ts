import { describe, it, expect, vi } from "vitest";
import { createDefaultCategoriesFor, DEFAULT_CATEGORIES } from "./categories";

describe("createDefaultCategoriesFor", () => {
  it("crea una categoría por nombre por defecto, todas con el userId dado", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: DEFAULT_CATEGORIES.length });
    const client = { category: { createMany } };

    await createDefaultCategoriesFor(client as never, "user-123");

    expect(createMany).toHaveBeenCalledOnce();
    const arg = createMany.mock.calls[0][0] as { data: { userId: string; name: string }[] };
    expect(arg.data).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(arg.data.every((c) => c.userId === "user-123")).toBe(true);
    expect(arg.data.map((c) => c.name)).toEqual([...DEFAULT_CATEGORIES]);
  });

  it("incluye las categorías esperadas en español AR", () => {
    expect(DEFAULT_CATEGORIES).toContain("Supermercado");
    expect(DEFAULT_CATEGORIES).toContain("Indumentaria");
    expect(DEFAULT_CATEGORIES).toContain("Otros");
  });
});
