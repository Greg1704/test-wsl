import { test, expect, type Page } from "@playwright/test";

/**
 * Capturas de pantalla para QA visual y screenshots de portfolio (no es un test
 * funcional). Requiere la cuenta de demo creada por `scripts/seed-demo.ts` +
 * `scripts/reset-password.ts`. Se ejecuta solo con DEMO_SHOTS=1 para no correr
 * junto a la suite normal:
 *
 *   docker compose run --rm --no-deps -e DEMO_SHOTS=1 e2e
 */
const EMAIL = process.env.DEMO_EMAIL ?? "a@gmail.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-cuotapp-2026";
const OUT = "test-results/shots";

test.skip(process.env.DEMO_SHOTS !== "1", "solo para capturas manuales");

async function login(page: Page) {
  // networkidle espera la hidratación (en dev la primera visita compila la página;
  // un click prematuro dispara el submit GET nativo del form).
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe("capturas del rediseño", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("dashboard + páginas en claro y oscuro", async ({ page }) => {
    // Login primero como página (branding de auth), después como sesión.
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${OUT}/login-light.png` });

    await login(page);

    // Dejar terminar la animación de los charts antes de capturar.
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/dashboard-light.png`, fullPage: true });

    // Modo oscuro desde el menú de usuario del sidebar.
    await page.getByRole("button", { name: /a@gmail/ }).click();
    await page.getByRole("menuitemradio", { name: "Oscuro" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/dashboard-dark.png`, fullPage: true });

    await page.goto("/calendario");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/calendario-dark.png`, fullPage: true });

    // Volver a claro para las demás páginas.
    await page.getByRole("button", { name: /a@gmail/ }).click();
    await page.getByRole("menuitemradio", { name: "Claro" }).click();
    await page.keyboard.press("Escape");

    await page.goto("/calendario");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/calendario-light.png`, fullPage: true });

    await page.goto("/compras");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/compras-light.png`, fullPage: true });

    await page.goto("/tarjetas");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/tarjetas-light.png`, fullPage: true });
  });

  test("dashboard mobile (sidebar como drawer)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/dashboard-mobile.png`, fullPage: true });

    // Drawer abierto.
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/dashboard-mobile-drawer.png` });
  });
});
