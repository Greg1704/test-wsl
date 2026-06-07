# PLAN — Fase 2: Core de cuotas

Plan de implementación de la **Fase 2** del roadmap (`docs/ROADMAP.md`).
Cubre **RF-3** (registro de compras), **RF-4** (gestión de cuotas) y **RF-7**
(categorías). Es el corazón del producto: a partir de acá la app deja de ser
"tarjetas sueltas" y empieza a modelar el flujo de cuotas.

> Fuente de verdad del alcance: `ROADMAP.md`. Requerimientos: `REQUIREMENTS.md`.
> Reglas de oro: `.claude/rules/*`. Skill aplicable: `.claude/skills/crear-feature-cuotas`.

---

## 1. Objetivo

Que el usuario pueda **registrar una compra en cuotas**, ver el **listado filtrable**
de sus compras, abrir el **detalle con sus cuotas**, **marcar cuotas como pagadas**
(y revertir), **editar/eliminar** compras y **gestionar sus categorías**. Todo
materializado (las cuotas se generan al crear la compra, no se calculan al vuelo).

Al terminar la fase, el happy-path E2E de compra (`e2e/happy-path.spec.ts`, hoy en
`test.skip`) debe poder activarse: crear tarjeta → compra en 6 cuotas → ver cuotas →
marcar una pagada.

---

## 2. Estado actual (lo que YA existe)

No arrancamos de cero. La capa de dominio y parte del server ya están hechos y testeados:

| Pieza | Archivo | Estado |
|---|---|---|
| Schema `Purchase` / `Installment` / `Category` | `prisma/schema.prisma` | ✅ migrado |
| Generación de cuotas + interés compuesto | `src/server/lib/installments.ts` | ✅ testeado |
| Helpers de dinero | `src/server/lib/money.ts` | ✅ testeado |
| Helpers de fecha (`nextBusinessDay`, etc.) | `src/server/lib/dates.ts` | ✅ testeado |
| Seed de 8 categorías por defecto | `src/server/lib/categories.ts` | ✅ (hook post-signup) |
| Validación Zod de compra | `src/lib/validation/purchase.ts` | ✅ |
| `createPurchase`, `getPurchaseById` | `src/server/actions/purchases.ts` | ✅ |
| Patrón de UI de referencia | `src/components/tarjetas/*` | ✅ (imitar este patrón) |

**Lo que falta** es, básicamente, **toda la UI** de compras/cuotas/categorías, las
**server actions** que aún no existen (listar/editar/borrar compras, marcar cuotas,
CRUD de categorías) y el **cómputo de OVERDUE** al leer.

---

## 3. Decisiones tomadas (sesión 2026-06-02)

1. **Entregable**: este documento (`docs/PLAN-FASE-2.md`).
2. **Categorías**: **CRUD completo** en esta fase (crear, renombrar, color/ícono, borrar) — cumple RF-7.1 al 100%.
3. **Tope de cuotas**: se **mantiene 60** (no 24). ⚠️ Hay que **actualizar RF-3.1** en `REQUIREMENTS.md` de "1 a 24" → "1 a 60".
4. **Compras UI**: incluye **filtros completos** (RF-3.8), **detalle con cuotas** + marcar pagada/revertir (RF-3.9, RF-4.2/4.3) y **editar/eliminar** (RF-3.6/3.7).

---

## 4. Procedimiento (bloques en orden de dependencia)

Cada bloque deja `npm run typecheck && npm test` en verde antes de pasar al siguiente.

### Bloque A — Server: completar la capa de datos

Sin UI todavía; primero dejamos las server actions y helpers listos y testeados.

1. **Estado OVERDUE computado al leer (RF-4.4).** Helper puro nuevo
   `computeDisplayStatus(installment, today)`: si `status === "PENDING"` y
   `dueDate < hoy` ⇒ devuelve `"OVERDUE"` (solo para display; **no** se persiste,
   no hace falta cron). Vive en `src/server/lib/installment-status.ts` con su test.
2. **Server actions de compras** (extender `src/server/actions/purchases.ts`):
   - `listPurchases(filters)` — filtra por `userId` **siempre** + opcionalmente por
     `cardId`, mes (`purchaseDate` en rango), `categoryId`, `currency` (RF-3.8).
     Incluye `card` y `category` para mostrar nombres; cuenta de cuotas.
   - `updatePurchase(id, input)` — solo campos descriptivos (`description`,
     `categoryId`, `notes`, `merchant`). **No recalcula cuotas** (RF-3.6). Vía
     `updateMany({ where: { id, userId } })`.
   - `deletePurchase(id)` — `deleteMany({ where: { id, userId } })`; las cuotas caen
     por `onDelete: Cascade` (RF-3.7).
3. **Server actions de cuotas** (archivo nuevo `src/server/actions/installments.ts`):
   - `markInstallmentPaid(id)` — set `status: PAID`, `paidAt: now`. Autoriza vía
     `purchase: { userId }` en el `where` (la cuota no tiene `userId` directo).
   - `revertInstallment(id)` — set `status: PENDING`, `paidAt: null` (RF-4.3).
4. **Server actions de categorías** (archivo nuevo `src/server/actions/categories.ts`):
   - `listCategories()`, `createCategory`, `updateCategory`, `deleteCategory`
     (RF-7.1). Todas filtradas por `userId`. Al borrar, las compras quedan con
     `categoryId: null` (el schema ya tiene `onDelete: SetNull`).
   - Validación nueva: `src/lib/validation/category.ts` (`name` 1–40, `color?`,
     `icon?`).
5. **Ajuste de validación**: en `src/lib/validation/purchase.ts` agregar el schema de
   **edición** (subset descriptivo) si conviene separarlo del de alta.

### Bloque B — UI: registrar compra

6. **Ruta `/compras`** (`src/app/(dashboard)/compras/page.tsx`) — Server Component que
   llama `listPurchases` + `loading.tsx` (skeleton, RNF-7.5).
7. **`<PurchaseFormDialog>`** (`src/components/compras/purchase-form-dialog.tsx`) —
   imita `card-form-dialog.tsx`: `react-hook-form` + `zodResolver(purchaseSchema)`,
   modal que abre limpio (`form.reset` en `onOpenChange`). Campos:
   - tarjeta (Select de `listActiveCards` — solo activas y no vencidas),
   - categoría (Select de `listCategories` + opción "Nueva categoría…" al vuelo),
   - descripción, comercio (opcional), monto (input numérico → centavos en el server),
   - moneda (ARS/USD; **default = moneda de la tarjeta elegida**),
   - cuotas (Select 1–60), fecha de compra (date picker), tasa de interés mensual
     (opcional), notas (opcional).
   - **Preview en vivo** (opcional, alto valor de portfolio): mostrar el monto de
     cuota estimado reutilizando `generateInstallments` del lado cliente (función
     pura, sin I/O) — adelanto del simulador de Fase 4.
8. **Habilitar el nav**: en `src/app/(dashboard)/layout.tsx` convertir el placeholder
   `<span>Compras</span>` en `<Link href="/compras">`.

### Bloque C — UI: listado, detalle y gestión de cuotas

9. **`<PurchaseList>` + `<PurchaseFilters>`** (`src/components/compras/`) — tabla
   (usar `ui/table.tsx`) con descripción, tarjeta, monto total, cuotas (ej. "3/12"),
   estado. Barra de filtros (tarjeta, mes, categoría, moneda) que actualiza la query
   (search params del lado server, o estado + re-fetch). Empty state si no hay compras.
10. **Detalle de compra** (`src/app/(dashboard)/compras/[id]/page.tsx`) — Server
    Component con `getPurchaseById`. Muestra cabecera (monto total, tarjeta, fecha,
    interés) + lista de cuotas con su `dueDate`, monto, número y **estado computado**
    (`computeDisplayStatus`). Cada cuota: botón "Marcar pagada" / "Revertir".
11. **`<InstallmentRow>` / `<InstallmentList>`** (client) — badges de estado
    (`PENDING` / `PAID` / `OVERDUE`) y acciones que llaman las server actions del
    Bloque A, con `toast` de feedback (patrón de `sonner` ya usado).
12. **Editar / eliminar compra** — reusar `<PurchaseFormDialog>` en modo edición
    (solo campos descriptivos) + botón de borrado con **confirmación** (`AlertDialog`).

### Bloque D — UI: categorías

13. **Gestión de categorías** — decisión de ubicación: sección dentro de `/compras`
    (dialog "Gestionar categorías") **o** ruta propia `/categorias`. Recomendado:
    `<CategoriesManagerDialog>` accesible desde `/compras`, para no inflar el nav.
    CRUD con lista + form inline (nombre, color, ícono opcional). Imita el patrón de
    `deactivated-cards-dialog.tsx`.

### Bloque E — Tests y cierre

14. **Component tests** (Vitest + RTL): `<PurchaseFormDialog>` (validación, submit,
    preview de cuota) — RNF-6.1, prioridad media de `.claude/rules/testing.md`.
15. **Unit test nuevo**: `installment-status.test.ts` (PENDING vencida ⇒ OVERDUE;
    PAID nunca pasa a OVERDUE; borde "vence hoy").
16. **E2E**: sacar el `test.skip` de `e2e/happy-path.spec.ts` (parte 2) e implementar
    el flujo real ahora que existe la UI (RNF-6.3).
17. **Doc**: actualizar `ROADMAP.md` (Fase 2 → ✅), `PROXIMOS-PASOS.md` y **corregir
    RF-3.1** en `REQUIREMENTS.md` (1–60).

---

## 5. Archivos a crear / modificar

### Crear

| Archivo | Para qué |
|---|---|
| `src/server/lib/installment-status.ts` (+ `.test.ts`) | `computeDisplayStatus` (OVERDUE computado, RF-4.4) |
| `src/server/actions/installments.ts` | `markInstallmentPaid`, `revertInstallment` (RF-4.2/4.3) |
| `src/server/actions/categories.ts` | CRUD de categorías (RF-7.1) |
| `src/lib/validation/category.ts` | Schema Zod de categoría |
| `src/app/(dashboard)/compras/page.tsx` (+ `loading.tsx`) | Listado de compras |
| `src/app/(dashboard)/compras/[id]/page.tsx` | Detalle de compra + cuotas (RF-3.9) |
| `src/components/compras/purchase-form-dialog.tsx` | Form de alta/edición (RF-3.1/3.6) |
| `src/components/compras/purchase-list.tsx` | Tabla de compras |
| `src/components/compras/purchase-filters.tsx` | Filtros (RF-3.8) |
| `src/components/compras/installment-list.tsx` | Cuotas + acciones (RF-4) |
| `src/components/compras/delete-purchase-button.tsx` | Borrado con confirmación (RF-3.7) |
| `src/components/categorias/categories-manager-dialog.tsx` | CRUD de categorías (RF-7.1) |
| Tests de componentes (`*.test.tsx`) | RNF-6.1 |

### Modificar

| Archivo | Cambio |
|---|---|
| `src/server/actions/purchases.ts` | + `listPurchases`, `updatePurchase`, `deletePurchase` |
| `src/lib/validation/purchase.ts` | + schema de edición (descriptivo) si se separa |
| `src/app/(dashboard)/layout.tsx` | Activar link "Compras" (quitar placeholder) |
| `e2e/happy-path.spec.ts` | Quitar `test.skip`, implementar flujo de compra |
| `src/server/actions/__tests__/authorization.test.ts` | + casos cross-user para las nuevas actions (cuotas, categorías) |
| `docs/REQUIREMENTS.md` | RF-3.1: 1–24 → **1–60** |
| `docs/ROADMAP.md` / `docs/PROXIMOS-PASOS.md` | Marcar Fase 2 avanzada/hecha |

### Componentes shadcn/ui a agregar (probables)

`badge` (estado de cuota), `textarea` (notas), `popover` (date picker, ya hay
`calendar.tsx`), `alert-dialog` (confirmación de borrado). Instalar con el CLI de
shadcn, no a mano.

---

## 6. Detalles técnicos a tener en cuenta (críticos)

- **Dinero = BigInt en centavos.** El input del form toma un `number` (pesos) y se
  convierte con `currencyToCents` en el **server** (ya lo hace `createPurchase`).
  Formateo solo en presentación con `formatMoney`. Ver `.claude/rules/dinero-y-fechas.md`.
- **BigInt no es serializable a JSON.** Al pasar compras/cuotas de Server a Client
  Component, convertir `amountCents` / `totalAmountCents` a **`string`** en el borde
  (o mapear a un DTO con `formatMoney` ya aplicado). Es el bug más fácil de cometer
  acá.
- **Autorización en TODA query (RNF-1.1).** `Purchase` y `Category` filtran por
  `userId` directo. `Installment` **no tiene `userId`**: autorizar siempre vía la
  relación → `where: { id, purchase: { userId } }`. El test de autorización debe
  cubrir las nuevas actions.
- **Materializar, no calcular al vuelo.** Las cuotas se generan en la **transacción**
  de alta (ya implementado). Editar una compra **no** regenera cuotas (RF-3.6). El
  único estado que se computa al leer es `OVERDUE` (display), nunca se persiste.
- **OVERDUE sin cron (RF-4.4).** Se deriva en lectura con `computeDisplayStatus`. La
  DB solo guarda `PENDING`/`PAID`. Esto evita un job programado en el MVP.
- **Moneda por compra (RF-9.1).** Nunca sumar montos de monedas distintas; la moneda
  de la compra hereda por default la de la tarjeta. Los totales/agregaciones se
  separan por `currency`.
- **Validación doble (RNF-1.2).** Zod en el server **siempre**, aunque el form ya
  valide. El filtro de tipeo en inputs (numéricos, etc.) es UX, no seguridad — ver
  `.claude/rules/ui.md`.
- **Reglas de UI.** Filas de campos con `items-start`; `Select` con `position="popper"`
  (largo 1–60 cuotas); modal que abre limpio; estados loading/empty/error siempre
  contemplados (RNF-7.5). Todo en `.claude/rules/ui.md`.
- **RSC por default (RNF-3.4).** Páginas y listados como Server Components; `"use
  client"` solo en los dialogs/forms y las filas con acciones.
- **`revalidatePath`** tras cada mutación, apuntando a `/compras` (y al detalle
  `/compras/[id]` cuando aplique). Hoy `createPurchase` revalida `/dashboard`: sumar
  `/compras`.

---

## 7. Testing (prioridades de `.claude/rules/testing.md`)

1. **Unit (máx. prioridad)** — `installment-status.test.ts`. `generateInstallments` y
   `money`/`dates` ya están cubiertos; revisar que el cambio de tope a 60 no rompa
   asserts.
2. **Autorización (alta)** — extender `authorization.test.ts`: usuario A no puede
   marcar cuotas, editar/borrar compras ni tocar categorías de B.
3. **E2E happy path (alta, portfolio)** — activar la parte 2 del happy-path.
4. **Component (media)** — `<PurchaseFormDialog>`, `<InstallmentList>`.

Cobertura objetivo de dominio: ≥70% sobre `src/server/lib/` (RNF-5.4).

---

## 8. Definición de "hecho" (checklist de cierre de fase)

- [ ] Alta de compra genera N cuotas en transacción, con reparto de centavos exacto.
- [ ] Listado de compras con filtros por tarjeta, mes, categoría y moneda.
- [ ] Detalle de compra con todas las cuotas y su estado (incl. OVERDUE computado).
- [ ] Marcar cuota pagada / revertir, con fecha de pago.
- [ ] Editar compra (descriptivo, sin recalcular) y eliminar con confirmación.
- [ ] CRUD completo de categorías.
- [ ] Nav "Compras" habilitado.
- [ ] `npm run typecheck && npm test` en verde; lint sin warnings.
- [ ] E2E happy-path de compra pasando (sin `test.skip`).
- [ ] Docs actualizados (ROADMAP, REQUIREMENTS RF-3.1, PROXIMOS-PASOS).

---

## 9. Riesgos / puntos de atención

- **Serialización de BigInt** entre server/client (mencionado arriba): testear el
  render del listado con montos reales temprano.
- **Filtro "mes"**: definir si filtra por `purchaseDate` (mes de la compra) o por mes
  de vencimiento de cuota. Para RF-3.8 se asume **mes de la compra**; el calendario
  por vencimiento es Fase 3.
- **Categoría borrada con compras asociadas**: el `onDelete: SetNull` ya cubre esto;
  confirmar el mensaje al usuario ("las compras quedarán sin categoría").
- **Preview de cuota en el form**: usa `generateInstallments` en el cliente. Es código
  puro compartido server/client — verificar que no arrastre imports de Node.
