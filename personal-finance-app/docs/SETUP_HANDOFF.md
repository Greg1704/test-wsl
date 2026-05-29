# Setup gaps & handoff — CuotApp

Documento de handoff para Claude Code. Resume las brechas detectadas entre la
documentación del proyecto (`docs/`, `.claude/rules/`, `CLAUDE.md`) y el estado
actual del repo, y propone un orden de trabajo **antes de empezar la fase de
diseño visual**.

> **Cómo arrancar la sesión:** leé `CLAUDE.md` y las reglas que importa
> (`.claude/rules/*.md`). Para features de dominio usá la skill
> `crear-feature-cuotas`; para cambios de schema, `agregar-tabla-prisma`.
> Después de cada tarea: `npm run typecheck && npm test`. Antes de cerrar un
> bloque, además: `npm run lint`. Commits en Conventional Commits.

---

## Cómo usar este documento

- Está organizado en bloques **A → F** con dependencias hacia adelante:
  resolvé un bloque entero antes de pasar al siguiente.
- Cada tarea declara **archivos**, **objetivo**, **criterios de aceptación** y
  **commit sugerido**.
- Si una tarea pide tomar una decisión de diseño (ej. A2 sobre interés),
  parala, escribí la decisión en `docs/ARCHITECTURE.md`, y recién después
  implementá.

---

## Bloque A — Desbloqueo de la fase visual

Sin esto, no se pueden construir las páginas ni los formularios reales.

### A1. Agregar el componente `Form` de shadcn

- **Archivos:** `src/components/ui/form.tsx` (nuevo). Instalar vía
  `npx shadcn@latest add form` si conviene.
- **Objetivo:** soportar `react-hook-form` + `zod` con la convención de
  shadcn, ya que `@hookform/resolvers` y `react-hook-form` están instalados
  pero el wrapper falta.
- **Aceptación:** exporta `Form`, `FormField`, `FormItem`, `FormLabel`,
  `FormControl`, `FormDescription`, `FormMessage`. `npm run typecheck` pasa.
- **Commit:** `feat(ui): add shadcn form component`

### A2. Montar `ThemeProvider` y `Toaster` en el root layout, y actualizar metadata

- **Archivos:** `src/app/layout.tsx`, posiblemente nuevo
  `src/components/theme-provider.tsx` (wrapper client de `next-themes`).
- **Objetivo:** que `sonner` y el modo oscuro funcionen, y que la app deje
  de identificarse como "Create Next App".
- **Aceptación:**
  - `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
    envuelve el árbol.
  - `<Toaster />` está mounted (usando el componente de
    `src/components/ui/sonner.tsx`).
  - `metadata.title` = `"CuotApp"`, `metadata.description` con copy real en
    español rioplatense.
  - Lang del `<html>` = `"es-AR"`.
- **Commit:** `feat(app): mount theme provider, toaster and update metadata`

### A3. Helper de sesión server-side

- **Archivos:** `src/server/auth/session.ts` (nuevo).
- **Objetivo:** función `getSession()` que use `auth.api.getSession({ headers: await headers() })`
  y devuelva `Session | null`. Una variante `requireUser()` que redirija a
  `/login` si no hay sesión (para Server Components).
- **Aceptación:** importable desde Server Components y Server Actions; no
  expone secretos al cliente.
- **Commit:** `feat(auth): add server-side session helpers`

### A4. Rutas de auth básicas y middleware

- **Archivos:**
  - `src/app/(auth)/login/page.tsx`
  - `src/app/(auth)/signup/page.tsx`
  - `src/middleware.ts`
  - Layout opcional `src/app/(auth)/layout.tsx`.
- **Objetivo:** cubrir RF-1.1, RF-1.2, RF-1.5. **Esta tarea es solo
  estructura y wiring**, no el diseño visual final; usá los componentes
  shadcn ya disponibles, dejá la estética definitiva para la fase posterior.
- **Aceptación:**
  - Formularios mínimos email + password con validación Zod compartida
    (definir schemas en `src/lib/validation/auth.ts`).
  - Usan `authClient.signIn.email` / `authClient.signUp.email`.
  - Middleware protege todo `/(dashboard)/*` (placeholder) y redirige a
    `/login` si no hay sesión.
  - Un test (puede ser E2E en bloque C) que confirme la redirección.
- **Commit:** `feat(auth): add login/signup routes and route guard`

### A5. Página `/dashboard` placeholder y eliminación del boilerplate

- **Archivos:** `src/app/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`.
- **Objetivo:** `/` redirige a `/dashboard` si hay sesión, a `/login` si no.
  `/dashboard` es un placeholder mínimo (solo saluda al usuario por nombre)
  para que el bloque visual posterior tenga sobre qué iterar.
- **Aceptación:** ningún rastro del boilerplate de `create-next-app`.
- **Commit:** `feat(app): replace boilerplate with dashboard skeleton`

---

## Bloque B — Lógica de dominio crítica

### B1. Decidir y documentar la política de interés (RF-3.5)

- **Archivos:** `docs/ARCHITECTURE.md` (sección nueva: "Cálculo de cuotas
  con interés").
- **Objetivo:** definir si las cuotas con `interestRateMonthly` se calculan
  con **sistema francés** (cuota fija, intereses decrecientes) o **tasa fija
  sobre saldo / monto recargado** (cuotas iguales = total recargado / N).
  El producto apunta al mercado AR, donde la práctica más común en compras
  con tarjeta es "monto recargado en N cuotas iguales".
- **Criterio recomendado:** monto recargado en N cuotas iguales. Pero la
  decisión la toma el owner; **no implementes hasta que esta sección esté
  escrita en `ARCHITECTURE.md`** y mencione: fórmula exacta, manejo del
  redondeo de la última cuota, qué pasa si `interestRateMonthly` es `null`
  (= 0% / sin recargo).
- **Commit:** `docs(arch): document installment interest calculation policy`

### B2. Implementar el interés en `generateInstallments`

- **Depende de:** B1.
- **Archivos:** `src/server/lib/installments.ts` y
  `src/server/lib/installments.test.ts`.
- **Objetivo:** que `interestRateMonthly` afecte el monto de cada cuota
  según lo definido en B1.
- **Aceptación:**
  - Nuevos tests que cubren: tasa 0 / `null` (debe dar lo mismo que hoy),
    tasa positiva con N pequeño (3 cuotas), tasa positiva con N grande
    (24 cuotas), y verificación de que la suma de cuotas iguala al total
    recargado al centavo.
  - Los tests previos siguen pasando.
- **Commit:** `feat(installments): apply monthly interest rate to installment amounts`

### B3. Seed de categorías por defecto (RF-7.2)

- **Archivos:** `prisma/seed.ts` (nuevo), `package.json` (script `prisma`
  con `seed`).
- **Objetivo:** poder crear categorías iniciales para un usuario nuevo.
  Decisión a tomar: o bien un seed global del schema y luego un copy al
  registrarse, o bien un hook post-signup que llame a una función pura
  `createDefaultCategoriesFor(userId)`. Recomendado: lo segundo, porque
  cada usuario debe tener las suyas (FK por `userId`).
- **Aceptación:**
  - Lista de categorías en español AR (ej. Indumentaria, Tecnología,
    Supermercado, Servicios, Salud, Educación, Ocio, Otros).
  - Función `createDefaultCategoriesFor(userId)` en
    `src/server/lib/categories.ts` con test unit.
  - Se invoca tras un signup exitoso (hook de Better Auth o desde la
    server action de signup).
- **Commit:** `feat(categories): seed default categories on signup`

---

## Bloque C — Testing (es el diferencial del proyecto)

### C1. Tests unit de `money.ts` y `dates.ts`

- **Archivos:** `src/server/lib/money.test.ts`, `src/server/lib/dates.test.ts`.
- **Objetivo:** llegar a ≥70% en `src/server/lib/` (RNF-5.4).
- **Aceptación:**
  - `money`: redondeo (centavos), formateo ARS y USD con locale `es-AR`,
    casos borde (`0n`, valores muy grandes, decimales con 1 dígito).
  - `dates`: formateo en español, casos borde alrededor de cambios de
    mes/año.
- **Commit:** `test(server/lib): add unit tests for money and dates helpers`

### C2. Configurar Playwright y armar el happy path E2E

- **Archivos:** `playwright.config.ts` (nuevo), `e2e/happy-path.spec.ts`
  (nuevo).
- **Objetivo:** cubrir RNF-6.3: signup → login → crear tarjeta → registrar
  compra en 6 cuotas → ver calendario → marcar cuota pagada → logout.
- **Aceptación:**
  - `playwright.config.ts` apunta a `http://localhost:3000`, levanta el
    server de dev como `webServer` y usa una base de datos de test
    (variable `DATABASE_URL_TEST` documentada en `.env.example`).
  - El spec corre verde en local.
  - **Nota:** este test depende de tener formularios reales. Si la fase
    visual aún no construyó las pantallas de compra/calendario, dejá el
    spec con `test.skip` y un TODO claro; al menos signup+login+logout
    debería estar verde desde ya.
- **Commit:** `test(e2e): add playwright config and happy path spec`

### C3. Test de autorización A→B

- **Depende de:** que existan al menos 1-2 Server Actions reales.
- **Archivos:** `src/server/actions/__tests__/authorization.test.ts` (o
  equivalente), o un spec E2E.
- **Objetivo:** cubrir RNF-1.1. Confirmar que el usuario A nunca lee/edita
  recursos del B (probar con `Card` y `Purchase`).
- **Commit:** `test(security): verify cross-user authorization is enforced`

---

## Bloque D — Infra / deploy

### D1. `.env.example`

- **Archivos:** `.env.example` (nuevo, **commiteado**).
- **Objetivo:** RNF-9.2. Listar todas las variables sin valores reales.
- **Aceptación:** incluye `DATABASE_URL`, `DATABASE_URL_TEST` (si C2 lo
  introduce), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`.
- **Commit:** `chore(env): add .env.example`

### D2. `output: "standalone"` en `next.config.ts`

- **Archivos:** `next.config.ts`.
- **Objetivo:** `ARCHITECTURE.md` lo marca como crítico para el build
  Docker de producción.
- **Aceptación:** `npm run build` sigue funcionando localmente.
- **Commit:** `build(next): enable standalone output for production docker`

### D3 (opcional, Fase 6). Dockerfile + workflow de CI

Posponer si el foco actual es la fase visual; queda anotado para no
olvidarse. Cubre `RNF-6.2`, `RNF-10.1`, `RNF-10.3` y el bloque de
deployment de `ARCHITECTURE.md`.

---

## Bloque E — Drift de documentación

### E1. Actualizar el singleton de Prisma en `CLAUDE.md`

- **Archivos:** `CLAUDE.md`.
- **Objetivo:** el snippet del singleton en `CLAUDE.md` importa de
  `@prisma/client` sin adapter, pero el código real usa
  `@prisma/adapter-pg` + cliente generado en `src/generated/prisma/client`.
  Alinear el doc al código real.
- **Aceptación:** el snippet en `CLAUDE.md` coincide con
  `src/server/db/index.ts`.
- **Commit:** `docs(claude): align prisma singleton snippet with actual code`

### E2. Reflejar `User.image` en `ARCHITECTURE.md`

- **Archivos:** `docs/ARCHITECTURE.md`.
- **Objetivo:** el modelo `User` documentado no incluye `image`, que sí
  existe en el schema/migración (lo agregó Better Auth). Sumarlo en el
  bloque Prisma con un comentario aclarando que viene del CLI de Better
  Auth.
- **Commit:** `docs(arch): include User.image field in data model`

---

## Bloque F — Bug a verificar

### F1. Verificar el uso de `z.string().cuid()` en Zod 4

- **Archivos:** `src/lib/validation/purchase.ts`.
- **Objetivo:** en Zod 4, los validadores de formato se movieron a
  top-level (`z.cuid()`); la forma encadenada `z.string().cuid()` puede
  estar deprecada o removida según versión exacta (instalada: `^4.4.3`).
- **Aceptación:**
  - Reproducir un parseo con un cuid válido y otro inválido.
  - Si tira `TypeError` o warning, reemplazar por `z.cuid()` y ajustar el
    schema. Si funciona sin warnings, dejar un comentario corto explicando
    que se verificó.
- **Commit:** `fix(validation): migrate to z.cuid() for zod 4 compatibility`
  (si efectivamente hace falta el fix; si no, no hace falta commit).

---

## Orden recomendado

1. **A1 → A2 → A3 → A4 → A5** (desbloquea la fase visual)
2. **B1 (decisión humana) → B2 → B3** (lógica de dominio)
3. **E1, E2, F1** (rápidos, podés hacerlos en cualquier momento)
4. **D1, D2** (rápidos, antes del primer deploy)
5. **C1, C2, C3** (testing; C2 y C3 dependen de tener pantallas y actions)

Cuando todo el bloque A esté hecho, la fase de **diseño visual** puede
empezar con base sólida: layout limpio, tema, toasts, sesión y rutas reales
con datos del usuario.
