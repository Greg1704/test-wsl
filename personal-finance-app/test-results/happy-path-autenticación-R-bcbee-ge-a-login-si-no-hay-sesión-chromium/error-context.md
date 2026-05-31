# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: happy-path.spec.ts >> autenticación (RNF-6.3, parte 1) >> el middleware redirige a /login si no hay sesión
- Location: e2e/happy-path.spec.ts:34:7

# Error details

```
Error: page.goto: net::ERR_SSL_PROTOCOL_ERROR at http://app:3000/dashboard
Call log:
  - navigating to "http://app:3000/dashboard", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | function uniqueEmail() {
  4  |   return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@cuotapp.test`;
  5  | }
  6  | 
  7  | test.describe("autenticación (RNF-6.3, parte 1)", () => {
  8  |   test("signup → dashboard → logout → login", async ({ page }) => {
  9  |     const email = uniqueEmail();
  10 |     const password = "password-segura-123";
  11 |     const name = "QA Tester";
  12 | 
  13 |     // signup
  14 |     await page.goto("/signup");
  15 |     await page.getByLabel("Nombre").fill(name);
  16 |     await page.getByLabel("Email").fill(email);
  17 |     await page.getByLabel("Contraseña").fill(password);
  18 |     await page.getByRole("button", { name: "Crear cuenta" }).click();
  19 | 
  20 |     await expect(page).toHaveURL(/\/dashboard/);
  21 |     await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  22 | 
  23 |     // logout
  24 |     await page.getByRole("button", { name: "Cerrar sesión" }).click();
  25 |     await expect(page).toHaveURL(/\/login/);
  26 | 
  27 |     // login con las mismas credenciales
  28 |     await page.getByLabel("Email").fill(email);
  29 |     await page.getByLabel("Contraseña").fill(password);
  30 |     await page.getByRole("button", { name: "Ingresar" }).click();
  31 |     await expect(page).toHaveURL(/\/dashboard/);
  32 |   });
  33 | 
  34 |   test("el middleware redirige a /login si no hay sesión", async ({ page }) => {
> 35 |     await page.goto("/dashboard");
     |                ^ Error: page.goto: net::ERR_SSL_PROTOCOL_ERROR at http://app:3000/dashboard
  36 |     await expect(page).toHaveURL(/\/login/);
  37 |   });
  38 | });
  39 | 
  40 | test.describe("compra en cuotas (RNF-6.3, parte 2)", () => {
  41 |   // TODO: habilitar cuando la fase de diseño visual construya las pantallas de
  42 |   // tarjetas, registro de compra y calendario de cuotas. Flujo objetivo:
  43 |   // crear tarjeta → registrar compra en 6 cuotas → ver calendario →
  44 |   // marcar una cuota como pagada.
  45 |   test.skip("crear tarjeta → compra en 6 cuotas → calendario → marcar cuota pagada", async () => {
  46 |     // pendiente de UI
  47 |   });
  48 | });
  49 | 
```