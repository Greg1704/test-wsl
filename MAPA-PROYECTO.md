# Mapa del proyecto — CuotApp

Guía de orientación para saber dónde está cada cosa y dónde crear cosas nuevas.
La raíz del código fuente es `personal-finance-app/`.

## Estructura general

```
personal-finance-app/
├── prisma/
│   ├── schema.prisma          ← modelo de datos (tablas, columnas, relaciones)
│   └── migrations/            ← historial SQL versionado (no tocar a mano)
│
├── src/
│   ├── app/                   ← TODO lo que es rutas/páginas (App Router de Next.js)
│   │   ├── layout.tsx         ← layout raíz (ThemeProvider, Toaster, fuente)
│   │   ├── page.tsx           ← página "/" (redirige a /login)
│   │   │
│   │   ├── (auth)/            ← rutas de autenticación (paréntesis = grupo, no aparece en URL)
│   │   │   ├── layout.tsx     ← layout compartido de login/signup
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   │
│   │   ├── (dashboard)/       ← rutas protegidas (requieren sesión activa)
│   │   │   └── dashboard/page.tsx   ← placeholder — acá van las pantallas reales
│   │   │
│   │   └── api/auth/[...all]/ ← endpoint de Better Auth (no tocar)
│   │
│   ├── components/
│   │   ├── ui/                ← componentes de shadcn/ui (Button, Input, Card…)
│   │   │                         NO editar a mano; agregar con: npx shadcn add <nombre>
│   │   ├── theme-provider.tsx ← wrapper de modo oscuro
│   │   └── sign-out-button.tsx← ejemplo de componente propio
│   │                              acá van los componentes reutilizables de la app
│   │
│   ├── lib/
│   │   ├── auth.ts            ← configuración de Better Auth (servidor)
│   │   ├── auth-client.ts     ← cliente de Better Auth (para Client Components)
│   │   ├── utils.ts           ← cn() helper de clases Tailwind
│   │   └── validation/        ← schemas Zod compartidos (auth, card, purchase)
│   │                              acá van los schemas de validación nuevos
│   │
│   ├── server/                ← código que SOLO corre en el servidor
│   │   ├── db/index.ts        ← singleton de Prisma (importar SIEMPRE de acá)
│   │   ├── auth/session.ts    ← helper getRequiredSession() para Server Actions
│   │   ├── actions/           ← Server Actions ("endpoints" de mutación)
│   │   │   ├── cards.ts       ← CRUD de tarjetas (listo para usar)
│   │   │   ├── purchases.ts   ← CRUD de compras (listo para usar)
│   │   │   └── __tests__/     ← tests de autorización
│   │   └── lib/               ← lógica de dominio pura + sus tests
│   │       ├── installments.ts ← generateInstallments() (el corazón del negocio)
│   │       ├── money.ts        ← helpers de formateo de montos
│   │       ├── dates.ts        ← helpers de fechas
│   │       └── categories.ts   ← categorías por defecto al registrarse
│   │
│   ├── generated/prisma/      ← cliente Prisma auto-generado (NUNCA editar)
│   ├── middleware.ts           ← protege las rutas de /dashboard sin sesión
│   └── test/setup.ts          ← configuración global de Vitest
│
└── e2e/                       ← tests de Playwright (flujo completo en el browser)
```

---

## Conceptos clave de Next.js App Router

**`page.tsx` = una ruta.**
Para crear la pantalla de tarjetas, creás `src/app/(dashboard)/tarjetas/page.tsx`
y automáticamente existe la ruta `/tarjetas`.

**Layouts anidados.**
Un `layout.tsx` dentro de una carpeta se aplica a todas las rutas hijas.
`(dashboard)/layout.tsx` puede tener la sidebar sin repetirla en cada página.

**Los paréntesis `(grupo)` no afectan la URL.**
Son solo agrupación para compartir layouts. `/dashboard` existe como ruta, `/(dashboard)` no.

**Server vs Client Components:**
- Por defecto todo es Server Component: corre solo en el servidor, puede acceder a la DB directamente.
- Si necesitás interactividad (`useState`, `onClick`, formularios con `react-hook-form`) → agregás `"use client"` al inicio del archivo.
- Las Server Actions (`src/server/actions/`) se llaman desde Client Components pero ejecutan en el servidor.

---

## Dónde crear cosas nuevas

| Qué necesitás crear            | Dónde                                              |
|--------------------------------|----------------------------------------------------|
| Nueva pantalla                 | `src/app/(dashboard)/<nombre>/page.tsx`            |
| Componente reutilizable        | `src/components/<nombre>.tsx`                      |
| Componente de shadcn           | `npx shadcn add <nombre>` → se instala en `src/components/ui/` |
| Mutación de datos              | `src/server/actions/<dominio>.ts`                  |
| Lógica de negocio pura         | `src/server/lib/<dominio>.ts` + `<dominio>.test.ts` al lado |
| Schema de validación Zod       | `src/lib/validation/<dominio>.ts`                  |
| Nueva tabla en la DB           | `prisma/schema.prisma` → `npx prisma migrate dev --name <desc>` |

---

## Comandos frecuentes

```bash
npm run dev                                 # servidor de desarrollo
npm run typecheck                           # verificar tipos (correr antes de commitear)
npm test                                    # Vitest (tests unitarios)
npm run test:e2e                            # Playwright (tests E2E)
npx prisma studio                           # inspección visual de la DB en el browser
npx prisma migrate dev --name <desc>        # nueva migración
docker compose up -d postgres               # levantar la base de datos local
npx shadcn add <nombre>                     # agregar componente de shadcn/ui
```
