# Próximos pasos — continuación de sesión

Estado al cerrar la sesión del **2026-06-13**. Sirve para retomar el trabajo
sin tener que reconstruir el contexto.

## Qué se hizo

### Sesión 2026-06-13 — Postura de deploy (Vercel + Neon) + CI (Fase 5)

- **Decisión de deploy:** el MVP se lanza en **Vercel (app) + Neon (Postgres)**,
  serverless y $0. **Docker queda solo para desarrollo**; VPS + Docker Compose pasa a
  ser "opción a futuro". Docs reescritos: `ARCHITECTURE.md` (sección Deployment entera),
  `REQUIREMENTS.md` (RNF-4, RNF-10, RNF-1.5), `ROADMAP.md` (Fase 6), `CLAUDE.md`,
  `SETUP.md` y `.claude/rules/seguridad.md`.
- **Prisma listo para Neon:** `prisma.config.ts` migra contra `DIRECT_URL ?? DATABASE_URL`
  (en prod, DATABASE_URL = endpoint pooled; DIRECT_URL = directo para DDL). `DIRECT_URL`
  documentado en `.env.example`. El singleton de runtime no cambió.
- **CI (Fase 5):** `.github/workflows/ci.yml` (en la raíz del repo, `working-directory:
  personal-finance-app`) corre **typecheck · lint · test · build** en push a main y PRs
  (Node 20, env dummy para el build). Portón de calidad: NO buildea imagen ni deploya
  (eso lo hace Vercel).
- **Lint en verde:** arreglados los 3 errores preexistentes + el de `form.watch`
  (`card-form-dialog`: comillas escapadas; `categories-manager-dialog`: componente
  `CategoryIcon` a nivel de módulo con `createElement`, y `form.watch` → `useWatch`).

**Verde:** `npm run typecheck`, `npm run lint` (sin errores), `npm test` (108 tests /
11 archivos) y `npm run build` (standalone).

**Pendiente — pasos manuales en las cuentas (los hace el owner, no son código):**
crear el proyecto en Neon (anotar las dos connection strings), conectar el repo a Vercel
con Root Directory = `personal-finance-app`, cargar las env vars (ver tabla en
`ARCHITECTURE.md` → Deployment) y setear el Build Command `prisma migrate deploy &&
next build`. Después: smoke test del happy path en prod.

### Sesión 2026-06-12 — Rediseño visual + dashboard con gráficos (Fase 3)

- **Dashboard rediseñado**: 4 KPI cards (disponible neto, cuotas del mes con % del
  ingreso y barra de progreso, deuda restante, "libre de cuotas"), **proyección a
  12 meses** (barras apiladas por tarjeta con línea de ingreso, un chart por moneda)
  y **donut de gasto por categoría** (RF-7.3 adelantado a Fase 3; ROADMAP y
  REQUIREMENTS actualizados). Datos vía helpers puros testeados en
  `src/server/lib/dashboard.ts` (`buildProjection`, `buildCategoryBreakdown`,
  `percentOfIncome`).
- **Recharts** (vía componentes `chart` de shadcn/ui) agregado al stack.
- **Rediseño de toda la app**: sidebar lateral colapsable (shadcn `sidebar`) con
  ítem activo, menú de usuario (tema claro/oscuro/sistema + sign out) y drawer en
  mobile; tema **esmeralda** en light/dark; calendario con chips de fecha, "hoy"
  resaltado y totales por día.
- **E2E verde en Docker** (pendiente 2 ✅). Fixes encadenados que lo bloqueaban:
  1. El hostname `app` activa el **HSTS preload del TLD `.app`** en Chromium
     (fuerza https → `ERR_SSL_PROTOCOL_ERROR`); ahora el E2E usa el alias
     `cuotapp` (docker-compose).
  2. `allowedDevOrigins: ["cuotapp"]` en `next.config.ts` (Next 16 bloquea
     `/_next/*` cross-origin en dev y la página nunca hidrata).
  3. `authClient` sin `baseURL` absoluto (usa el origen actual) +
     `BETTER_AUTH_TRUSTED_ORIGINS` para el origen del E2E.
  4. `TooltipProvider` global en el root layout (el sidebar colapsable lo requiere).
- **Herramientas de QA visual**: `scripts/seed-demo.ts` (cuenta demo con datos
  realistas ARS+USD; ⚠️ borra tarjetas/compras del usuario elegido) y
  `e2e/visual-demo.spec.ts` (screenshots con `DEMO_SHOTS=1`). Cuenta demo:
  `a@gmail.com` / `demo-cuotapp-2026`.

**Verde:** `npm run typecheck`, `npm test` (108 tests / 11 archivos) y
`npx playwright test` en Docker (4 passed). `npm run lint` mantiene 3 errores
**preexistentes** (`card-form-dialog`, `categories-manager-dialog`), ninguno nuevo.

### Sesión 2026-05-29
Se implementó **completo** el `docs/SETUP_HANDOFF.md` (bloques A–F) en el commit
**`dd7f742`** (`feat: implementar el setup handoff…`). Resumen:

- **A** — Form de shadcn, `ThemeProvider` + `Toaster` + metadata es-AR, helpers
  de sesión (`src/server/auth/session.ts`), rutas `(auth)/login` y `(auth)/signup`,
  `src/middleware.ts` (guarda de `/dashboard`) y dashboard placeholder. Se eliminó
  el boilerplate de create-next-app.
- **B** — interés compuesto sobre monto recargado en `generateInstallments`
  (decisión documentada en `ARCHITECTURE.md` → "Cálculo de cuotas con interés");
  categorías por defecto vía hook post-signup de Better Auth (`src/server/lib/categories.ts`)
  + `prisma/seed.ts` de backfill.
- **C** — tests unit de `money`/`dates`, test de autorización cross-user
  (`src/server/actions/__tests__/authorization.test.ts`) sobre las nuevas server
  actions de Card/Purchase, y Playwright + happy path de auth (flujo de compra en
  `test.skip` hasta tener UI).
- **D/E/F** — `.env.example` + `output: "standalone"`, singleton de Prisma y
  `User.image` alineados en los docs, migración a `z.cuid()`.
- **Extra** — se consolidaron reglas/skills en `.claude` (estaban en un dir con
  espacio inicial y los `@imports` de `CLAUDE.md` no resolvían); se arregló el
  script de lint (`next lint` → `eslint .`, removido en Next 16); se agregó `tsx`
  para correr el seed.

**Verde:** `npm run typecheck`, `npm test` (35 tests / 5 archivos), `npm run lint`,
`npm run build` (standalone).

### Sesión 2026-05-31
Se configuró el entorno de desarrollo con Docker completo:

- **Docker:** se agregó el servicio `app` al `docker-compose.yml` (antes solo tenía
  `postgres`). Incluye healthcheck en Postgres, migraciones automáticas al arrancar
  y volúmenes para hot reload.
- **`Dockerfile.dev`** — imagen de desarrollo de Next.js (instala deps, monta el
  código como volumen para hot reload).
- **ahoy** — instalado en el sistema (`v2.5.0`). `.ahoy.yml` con comandos rápidos
  para Docker, Prisma y tests. Ver sección de comandos abajo.

**NO verificado todavía** (pendiente de sesión anterior): la app en el browser y el E2E.

## Comandos del entorno (actualizado)

```bash
# Levantar todo (postgres + app, migraciones automáticas)
ahoy up

# Ver que está corriendo
ahoy ps

# Seguir los logs de la app una vez levantada
ahoy logs-app

# Bajar todo
ahoy down

# Reconstruir imagen (solo necesario si cambia package.json)
ahoy build
```

Los comandos de Prisma y tests se pueden correr **desde la terminal WSL directamente**
(más cómodo) o vía ahoy desde el contenedor:

```bash
# Desde WSL (recomendado para dev)
npx prisma migrate dev --name <desc>
npx prisma studio
npm test
npm run typecheck

# Equivalente vía ahoy (desde el contenedor)
ahoy migrate
ahoy studio
ahoy test
ahoy typecheck
```

## Pendientes (en orden)

### 1. Verificar contra una DB real
```bash
ahoy up               # levanta postgres + app (migraciones corren solas)
ahoy logs-app         # confirmar que Next.js arrancó en :3000
```
- Probar a mano en el browser: signup → dashboard → logout → login.
- Confirmar validación de forms, toast de error y modo oscuro.
- Confirmar el **hook de categorías**: registrar un usuario y verificar en
  `npx prisma studio` que se crean las 8 categorías por defecto.

### 2. Dejar verde el E2E — ✅ hecho (sesión 2026-06-12)
Corre en Docker contra la app de dev:
```bash
docker compose run --rm --no-deps e2e
```
La parte de auth pasa; el flujo de compra sigue en `test.skip` (habilitarlo es el
próximo paso natural ahora que la UI existe).

### 3. Decisiones chicas
- ✅ **`middleware.ts` → `proxy.ts`**: migrado con el codemod oficial de Next 16.
- ✅ **`.env` local**: `NEXT_PUBLIC_APP_URL` y `DATABASE_URL_TEST` agregados.
- Pendiente: regenerar `BETTER_AUTH_SECRET` para entornos no-dev (prod).

### 4. Construir el MVP (Fases 2-4 del roadmap)
> Roadmap canónico y frontera del MVP: `docs/ROADMAP.md`. **Estas son fases del
> producto**, no "pendientes" sueltos — no renumerar acá.

El shell/auth/rutas y la **Fase 1 (tarjetas)** ya están listos. Para cerrar el MVP:
- **Fase 2 — Core de cuotas**: form de compra + generación de cuotas, gestión de
  cuotas (marcar pagada/revertir), categorías.
- **Fase 3 — Dashboard + calendario**: métrica de **"disponible neto de cuotas"** mes
  a mes y calendario consolidado **multi-tarjeta** de vencimientos.
- **Fase 4 — Simulador**: "si compro esto en N cuotas…" (cierra el MVP).

Las server actions de Card/Purchase (`src/server/actions/`) ya están listas para
enganchar. A medida que existan las pantallas, sacar el `test.skip` del happy path.

### 5. Entrega del MVP (Fases 5-6 del roadmap)
- **Fase 5 — Testing + CI/CD**: dejar verde el E2E (ver pendiente 2) y montar el
  pipeline de GitHub Actions.
- **Fase 6 — Deploy**: **Vercel (app) + Neon (Postgres)**, serverless y $0 (decisión
  del 2026-06-12; Docker queda solo para dev, VPS es opción a futuro). Paso a paso y
  variables de entorno en `docs/ARCHITECTURE.md` → Deployment. Tareas: crear base en Neon,
  conectar el repo a Vercel, cargar env vars, agregar `DIRECT_URL` + fallback en
  `prisma.config.ts`, y poner el Build Command `prisma migrate deploy && next build`.

### Opcionales / cosmético
- Borrar los `public/*.svg` sin usar.
- Arreglar el symlink colgante `personal-finance-app/AGENTS.md` (apunta a un
  `CLAUDE.md` que no existe en este subdirectorio).
