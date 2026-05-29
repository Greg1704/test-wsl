---
name: crear-feature-cuotas
description: Usar cuando haya que crear o extender una feature de dominio de CuotApp end-to-end (compras, cuotas, tarjetas, categorías, calendario, simulador). Cubre el flujo completo desde el schema Prisma hasta la UI con su test. Disparar cuando el pedido sea "agregar/crear la feature de X", "registrar compras en cuotas", "armar el simulador", "marcar cuotas como pagadas", o similar.
---

# Skill: Crear una feature de dominio end-to-end

Workflow para construir una feature completa siguiendo la arquitectura del proyecto. Seguí los pasos en orden.

## 1. Modelo de datos (si aplica)

- Leé `docs/ARCHITECTURE.md` y revisá si hace falta tocar `prisma/schema.prisma`.
- Recordá: dinero en `BigInt` (centavos), fechas de calendario en `@db.Date`, cada modelo con `userId` + `@@index([userId])`.
- Migrá: `npx prisma migrate dev --name <desc>` y `npx prisma generate`.

## 2. Validación (Zod)

- Definí el schema en `src/lib/validation/<dominio>.ts`.
- Reusá el mismo schema en el form (cliente) y en la Server Action (servidor).

## 3. Lógica de dominio pura

- Si hay cálculo (cuotas, conversión de moneda, proyección), ponelo en `src/server/lib/` como **función pura testeable**.
- **Escribí el test unit ANTES o junto con la función** (`*.test.ts`), con casos borde. Ver `.claude/rules/dinero-y-fechas.md` para el reparto de centavos.

## 4. Server Action

- Creá/extendé `src/server/actions/<dominio>.ts` con `"use server"`.
- Pasos dentro de la action: obtener `userId` de la sesión → validar input con Zod → ejecutar (en `prisma.$transaction` si hay varias escrituras) → `revalidatePath(...)`.
- Filtrá SIEMPRE por `userId`. Nunca confíes en IDs que llegan del cliente sin verificar pertenencia.

## 5. UI

- Página/listado en Server Component (lee datos con Prisma directo).
- Formularios e interacción en Client Component con react-hook-form + shadcn/ui (`Form`, `Input`, `Select`, `Dialog`...).
- Convertí `BigInt` a `string` antes de pasar montos a Client Components.
- Estados de loading (`Skeleton`) y empty states.

## 6. Cierre

- `npm run typecheck && npm test`.
- Si es un flujo central, sumá o actualizá un test E2E de Playwright.
- Commit con Conventional Commits (`feat(<dominio>): ...`).

## Ejemplo de caso borde para el test de cuotas

```ts
// total 10000 (=$100,00) en 3 cuotas → 3333, 3333, 3334 ; suma exacta = 10000
// compra el día del cierre → primer vencimiento el mes siguiente
// compra un día después del cierre → primer vencimiento se corre un mes más
```
