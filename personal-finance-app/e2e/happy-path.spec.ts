import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@cuotapp.test`;
}

test.describe("autenticación (RNF-6.3, parte 1)", () => {
  test("signup → dashboard → logout → login", async ({ page }) => {
    const email = uniqueEmail();
    const password = "password-segura-123";
    const name = "QA Tester";

    // signup. networkidle espera la hidratación: en dev Next compila la página en
    // la primera visita y un click prematuro dispara el submit GET nativo del form.
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();

    // logout: el sign-out vive en el menú de usuario del sidebar (footer)
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);

    // login con las mismas credenciales
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("el middleware redirige a /login si no hay sesión", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("compra en cuotas (RNF-6.3, parte 2)", () => {
  // TODO: habilitar cuando la fase de diseño visual construya las pantallas de
  // tarjetas, registro de compra y calendario de cuotas. Flujo objetivo:
  // crear tarjeta → registrar compra en 6 cuotas → ver calendario →
  // marcar una cuota como pagada.
  test.skip("crear tarjeta → compra en 6 cuotas → calendario → marcar cuota pagada", async () => {
    // pendiente de UI
  });
});
