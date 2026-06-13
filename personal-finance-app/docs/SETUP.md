# SETUP — Cómo levantar el proyecto desde cero

Guía paso a paso para inicializar **CuotApp** (app de finanzas personales centrada en cuotas).
Stack: **Next.js (App Router) + TypeScript + Prisma + PostgreSQL + Better Auth + Tailwind v4 + shadcn/ui + Docker**.

> Si usás Claude Code: este archivo, junto con `CLAUDE.md` y `.claude/`, le da todo el contexto.
> Podés pedirle "seguí los pasos de docs/SETUP.md a partir del paso N".

---

## 0) Requisitos previos

- **Node.js 20 LTS o superior** (`node -v`). Si tenés varias versiones, usá `nvm`.
- **Docker Desktop** o Docker Engine + Docker Compose v2 (`docker --version`, `docker compose version`).
- **Git** y una cuenta de GitHub (repo público para portfolio).
- Editor: VS Code recomendado.

---

## 1) `create-next-app`: ¿defaults o no?

Ya tiraste `npx create-next-app@latest`. **No aceptes los defaults a ciegas.** Estas son las respuestas recomendadas para este proyecto:

| Prompt | Respuesta | Por qué |
|---|---|---|
| Project name | `cuotapp` (o el que quieras) | — |
| Would you like to use **TypeScript**? | **Yes** | Innegociable para portfolio moderno. |
| Would you like to use **ESLint**? | **Yes** | Higiene de código + queda lindo en CI. |
| Would you like to use **Tailwind CSS**? | **Yes** | Es nuestro stack de estilos. |
| Would you like your code inside a **`src/`** directory? | **Yes** | La estructura de la guía asume `src/`. |
| Would you like to use **App Router**? (recommended) | **Yes** | Obligatorio. El Pages Router está obsoleto para proyectos nuevos. |
| Would you like to use **Turbopack**? | **Yes** | Builds/dev más rápidos. Estable para este caso. |
| Would you like to **customize the import alias** (`@/*`)? | **No** (dejá `@/*`) | El default `@/*` es justo el que usa la guía. |

> Si ya corriste el comando con otras opciones, no pasa nada: borrá la carpeta y volvé a correrlo, o ajustá `tsconfig.json` (alias) y migrá a `src/` a mano. Es más rápido rehacerlo.

Verificá que arranca:

```bash
cd cuotapp
npm run dev
# abrí http://localhost:3000
```

---

## 2) Inicializar Git y primer commit

```bash
git init
git add -A
git commit -m "chore: bootstrap next.js app with create-next-app"
# creá el repo en GitHub y luego:
git remote add origin git@github.com:TU_USUARIO/cuotapp.git
git push -u origin main
```

Asegurate de que `.gitignore` (que genera Next.js) incluya `.env*`. **Nunca commitees `.env`.**

---

## 3) Copiar la documentación de agente a la raíz

Colocá estos archivos/carpetas en la raíz del repo (vienen en este paquete):

```
CLAUDE.md            # contexto principal para Claude Code
AGENTS.md            # symlink o copia de CLAUDE.md (estándar multi-herramienta)
.claude/
  rules/             # reglas temáticas que CLAUDE.md importa
  skills/            # workflows reutilizables (SKILL.md por carpeta)
docs/
  SETUP.md           # este archivo
  ARCHITECTURE.md
```

Para que `AGENTS.md` y `CLAUDE.md` no se desincronicen, podés hacer un symlink (en macOS/Linux):

```bash
ln -s CLAUDE.md AGENTS.md
```

En Windows, o si preferís evitar symlinks, mantené `AGENTS.md` como una copia con una sola línea que apunte a `CLAUDE.md` (ver el propio `AGENTS.md` de este paquete).

```bash
git add CLAUDE.md AGENTS.md .claude docs
git commit -m "docs: add agent docs (CLAUDE.md, skills, rules) and setup guide"
```

---

## 4) Tailwind v4 + shadcn/ui

`create-next-app` ya instaló Tailwind v4. Ahora inicializá shadcn/ui:

```bash
npx shadcn@latest init
```

Respuestas sugeridas: estilo "New York", color base "Neutral" (o el que prefieras), y CSS variables = Yes.

Agregá los primeros componentes que vas a necesitar:

```bash
npx shadcn@latest add button card input label form select dialog table tabs calendar dropdown-menu sonner skeleton
```

---

## 5) Levantar PostgreSQL con Docker

Copiá `docker-compose.yml` (incluido en este paquete o ver `docs/ARCHITECTURE.md`) y levantá la base:

```bash
docker compose up -d postgres
# verificá:
docker compose ps
```

Por ahora solo necesitamos el contenedor de Postgres corriendo; la app la seguimos corriendo con `npm run dev` en local hasta la fase de deploy.

---

## 6) Prisma

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init --datasource-provider postgresql
```

Esto crea `prisma/schema.prisma` y agrega `DATABASE_URL` a `.env`. Configurá:

```env
# .env  (NO commitear)
DATABASE_URL="postgresql://app:dev@localhost:5432/cuotas?schema=public"
```

Creá el cliente singleton en `src/server/db/index.ts` (ver código en `CLAUDE.md` → sección Prisma).

Pegá el esquema de dominio (modelos `Card`, `Purchase`, `Installment`, etc.) desde `docs/ARCHITECTURE.md` en `prisma/schema.prisma` y corré la primera migración:

```bash
npx prisma migrate dev --name init
npx prisma generate
npx prisma studio   # inspección visual de la DB en el navegador
```

---

## 7) Better Auth

```bash
npm install better-auth
npx @better-auth/cli@latest generate   # agrega modelos User/Session/Account/Verification al schema
npx prisma migrate dev --name add_auth_tables
```

Creá:
- `src/lib/auth.ts` — config de Better Auth con `prismaAdapter` (ver `CLAUDE.md`).
- `src/lib/auth-client.ts` — cliente del lado browser.
- `src/app/api/auth/[...all]/route.ts` — handler.

Agregá a `.env`:

```env
BETTER_AUTH_SECRET="generá-uno-con: openssl rand -base64 32"
BETTER_AUTH_URL="http://localhost:3000"
```

---

## 8) Validación, fechas y utilidades de dinero

```bash
npm install zod react-hook-form @hookform/resolvers
npm install date-fns
```

Creá:
- `src/server/lib/money.ts` — helpers de centavos (BigInt) y formateo con `Intl.NumberFormat`.
- `src/server/lib/dates.ts` — wrappers de date-fns.
- `src/server/lib/installments.ts` — `generateInstallments()` (la pieza crítica).
- `src/lib/validation/` — schemas Zod compartidos.

---

## 9) Testing (tu diferencial de QA)

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
npx playwright install --with-deps
```

Scripts en `package.json`:

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Primer test recomendado: `src/server/lib/installments.test.ts` cubriendo el redondeo de centavos (ver `.claude/skills/crear-feature-cuotas/SKILL.md`).

---

## 10) Verificación final del entorno

```bash
docker compose up -d postgres
npm run dev          # app en :3000
npm run typecheck    # sin errores
npm test             # tests en verde
npx prisma studio    # DB accesible
```

Si los cinco funcionan, el entorno está listo. El deploy (Vercel + Neon; Docker queda solo para desarrollo) está documentado en `docs/ARCHITECTURE.md` → Deployment y se aborda en la Fase 6 del roadmap.

---

## Orden de fases (resumen)

1. **Fase 0** — Setup (este archivo).
2. **Fase 1** — Auth + layout + CRUD de tarjetas.
3. **Fase 2** — Core de cuotas (`Purchase`, `Installment`, `generateInstallments`).
4. **Fase 3** — Calendario + dashboard (ingreso neto de cuotas).
5. **Fase 4** — Simulador (**cierre del MVP**).
6. **Fase 5** — Testing + CI/CD.
7. **Fase 6** — Deploy a Vercel + Neon.

El roadmap canónico, la frontera del MVP (Fases 1-4) y la visión a futuro están en
`docs/ROADMAP.md`.
