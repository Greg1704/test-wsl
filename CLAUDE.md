# CLAUDE.md — CuotApp

Instrucciones persistentes para Claude Code en este repositorio. Se cargan al inicio de cada sesión.
Mantené este archivo conciso: lo que Claude puede inferir del código no hace falta repetirlo acá.

## Qué es este proyecto

**CuotApp** es una app de finanzas personales para el mercado argentino, centrada en el manejo de **compras en cuotas** con tarjeta de crédito. El caso de uso central que NINGÚN competidor cubre bien:

- Vista consolidada **multi-tarjeta** de las cuotas comprometidas a futuro.
- Métrica principal: **"ingreso disponible neto de cuotas"** mes a mes.
- Simulador previo a la compra ("si compro esto en N cuotas, así queda mi flujo futuro").
- Soporte para **pesos (ARS) y dólares (USD)**.

Es un **proyecto de portfolio** para saltar de un rol de QA a uno full stack. Por eso el código debe ser claro, testeado y bien documentado — la calidad importa tanto como la funcionalidad.

## Stack (no cambiar sin pedir)

- **Next.js** App Router + **TypeScript** (estricto).
- **Prisma** ORM + **PostgreSQL**.
- **Better Auth** (email/password) con `prismaAdapter`.
- **Tailwind v4 + shadcn/ui** (Radix por debajo).
- **Zod** + react-hook-form para validación.
- **date-fns** para fechas.
- **Vitest** (unit/component) + **Playwright** (E2E).
- **Docker** + docker-compose; deploy a VPS.

## Reglas de oro (leer SIEMPRE)

@.claude/rules/arquitectura.md
@.claude/rules/dinero-y-fechas.md
@.claude/rules/datos-y-prisma.md
@.claude/rules/seguridad.md
@.claude/rules/testing.md

## Convenciones rápidas

- Idioma: código y nombres de variables en **inglés**; comentarios y mensajes de UI en **español** (mercado AR).
- Commits: **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Imports: alias `@/*` (definido en `tsconfig.json`).
- Componentes UI: usar shadcn/ui antes de escribir CSS a mano.
- Nunca uses `any`. Aprovechá los tipos generados por Prisma.

## Cliente Prisma (singleton — usar SIEMPRE este)

```ts
// src/server/db/index.ts
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Nunca instancies `new PrismaClient()` en otro archivo: agota el pool de conexiones.

## Comandos del proyecto

```bash
npm run dev          # servidor de desarrollo
npm run typecheck    # tsc --noEmit (correr antes de cada commit)
npm run lint         # eslint
npm test             # vitest run
npm run test:e2e     # playwright
npx prisma studio    # inspección visual de la DB
npx prisma migrate dev --name <desc>   # nueva migración (dev)
docker compose up -d postgres          # levantar la base local
```

## Flujo de trabajo esperado

1. Antes de tocar la DB, leé `docs/ARCHITECTURE.md` (modelo de datos).
2. Para features nuevas de dominio, mirá si hay una skill en `.claude/skills/` que aplique.
3. Después de cambiar el schema: `prisma migrate dev` + regenerar cliente.
4. Toda mutación va en una **Server Action** (`"use server"`), validada con Zod, filtrada por `userId` de la sesión.
5. Antes de dar por terminada una tarea: `npm run typecheck && npm test`.

## Qué NO hacer

- No usar Pages Router (`getServerSideProps`, `pages/api/`, etc.).
- No usar floats para dinero (ver `.claude/rules/dinero-y-fechas.md`).
- No marcar todo como `"use client"` por costumbre.
- No commitear `.env` ni secrets.
- No guardar números completos de tarjeta (solo `last4`).

## Documentación de referencia

- `docs/SETUP.md` — cómo levantar el proyecto desde cero.
- `docs/ARCHITECTURE.md` — modelo de datos, esquema Prisma, deployment.
