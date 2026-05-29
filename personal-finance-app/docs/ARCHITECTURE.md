# ARCHITECTURE — CuotApp

Modelo de datos, decisiones técnicas y deployment. Leé esto antes de tocar `prisma/schema.prisma`.

## Visión general

App full stack en un solo repo Next.js (App Router): los Server Components y Server Actions son el "backend", los Client Components el "frontend". Persistencia en PostgreSQL vía Prisma. Auth con Better Auth. Todo contenerizado con Docker.

```
Browser ──> Next.js (Server Components / Server Actions) ──> Prisma ──> PostgreSQL
                         │
                         └── Better Auth (sesión por cookie)
```

## Modelo de datos (Prisma)

> Las tablas de auth (`User` extendida, `Session`, `Account`, `Verification`) las genera el CLI de Better Auth. Acá se muestran los campos custom de `User` y los modelos de dominio.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String         @id @default(cuid())
  email              String         @unique
  name               String?
  emailVerified      Boolean        @default(false)
  image              String?                      // lo agrega el CLI de Better Auth
  defaultCurrency    String         @default("ARS")
  monthlyIncomeCents BigInt         @default(0)   // ingreso mensual en centavos
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  sessions   Session[]
  accounts   Account[]
  cards      Card[]
  purchases  Purchase[]
  categories Category[]
  rates      ExchangeRate[]
}

// Session, Account, Verification: generados por Better Auth (omitidos)

model Card {
  id         String     @id @default(cuid())
  userId     String
  name       String     // "Visa Galicia"
  brand      String?    // "Visa" | "Mastercard" | "Amex" ...
  last4      String?    // SOLO los últimos 4 dígitos
  closingDay Int        // día del mes de cierre (1-31)
  dueDay     Int        // día del mes de vencimiento (1-31)
  currency   String     @default("ARS")
  isActive   Boolean    @default(true)
  createdAt  DateTime   @default(now())

  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  purchases Purchase[]

  @@index([userId])
}

model Purchase {
  id                      String   @id @default(cuid())
  userId                  String
  cardId                  String
  categoryId              String?
  description             String
  merchant                String?
  totalAmountCents        BigInt   // monto total en centavos
  currency                String   @default("ARS")
  totalInstallments       Int      // N cuotas (>= 1)
  purchaseDate            DateTime @db.Date
  firstInstallmentDueDate DateTime @db.Date     // calculada al insertar
  interestRateMonthly     Decimal? @db.Decimal(8, 4)  // tasa mensual si hay interés
  notes                   String?
  createdAt               DateTime @default(now())

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  card         Card          @relation(fields: [cardId], references: [id], onDelete: Cascade)
  category     Category?     @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  installments Installment[]

  @@index([userId])
  @@index([cardId])
}

model Installment {
  id                String            @id @default(cuid())
  purchaseId        String
  installmentNumber Int               // 1, 2, 3, ...
  dueDate           DateTime          @db.Date   // vencimiento de ESTA cuota
  amountCents       BigInt            // monto de ESTA cuota
  currency          String            @default("ARS")
  status            InstallmentStatus @default(PENDING)
  paidAt            DateTime?
  createdAt         DateTime          @default(now())

  purchase Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)

  @@index([purchaseId])
  @@index([dueDate])
}

enum InstallmentStatus {
  PENDING
  PAID
  OVERDUE
}

model Category {
  id        String     @id @default(cuid())
  userId    String
  name      String
  color     String?
  icon      String?
  createdAt DateTime   @default(now())

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  purchases Purchase[]

  @@index([userId])
}

model ExchangeRate {
  id           String   @id @default(cuid())
  userId       String
  fromCurrency String
  toCurrency   String
  rate         Decimal  @db.Decimal(18, 6)
  validFrom    DateTime @db.Date

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

## Lógica clave: generar cuotas

`src/server/lib/installments.ts` — función pura, testeada:

```ts
function generateInstallments(input) {
  const { cardClosingDay, cardDueDay, purchaseDate, totalInstallments, totalAmountCents } = input;

  // 1) ¿Entra en este cierre o pasa al siguiente?
  const purchaseDay = getDate(purchaseDate);
  const firstStatementMonth = purchaseDay <= cardClosingDay
    ? addMonths(purchaseDate, 1)
    : addMonths(purchaseDate, 2);

  // 2) Reparto de centavos (la última cuota absorbe el resto)
  const n = BigInt(totalInstallments);
  const baseCents = totalAmountCents / n;
  const remainder = totalAmountCents - baseCents * n;

  // 3) N filas
  return Array.from({ length: totalInstallments }, (_, i) => ({
    installmentNumber: i + 1,
    amountCents: i === totalInstallments - 1 ? baseCents + remainder : baseCents,
    dueDate: setDate(addMonths(firstStatementMonth, i), cardDueDay),
    status: "PENDING" as const,
  }));
}
```

La compra y sus cuotas se insertan en una transacción (ver `.claude/rules/datos-y-prisma.md`).

## Cálculo de cuotas con interés (RF-3.5)

`Purchase.interestRateMonthly` es la **tasa mensual** del financiamiento (en %, ej. `5.5` = 5,5 % mensual). En Argentina la práctica más común en compras con tarjeta es informar un **monto recargado** que se paga en **N cuotas iguales**, así que ese es el modelo que usamos.

**Sistema elegido: monto recargado en N cuotas iguales, con interés compuesto mensual.**

```
i = interestRateMonthly / 100            // tasa mensual como fracción
totalRecargadoCents = round( totalAmountCents * (1 + i)^N )
```

- El factor `(1 + i)^N` se calcula en punto flotante (las tasas son fraccionarias por naturaleza) y el resultado se **redondea al centavo más cercano** una sola vez, obteniendo `totalRecargadoCents` como `BigInt`. A partir de ahí **toda la aritmética es entera** (BigInt), igual que sin interés.
- El reparto en N cuotas iguales reutiliza la regla de redondeo ya existente: `base = totalRecargado / N` (división entera) y la **última cuota absorbe el resto**, de modo que la suma de las cuotas es **exactamente** `totalRecargadoCents` (al centavo).
- **`interestRateMonthly` `null` o `0` ⇒ sin recargo:** `totalRecargado = totalAmountCents`, idéntico al comportamiento histórico (no se aplica ningún factor).

Ejemplo: $100,00 (`10000`) en 3 cuotas al 5 % mensual → factor `1,05³ = 1,157625` → recargado `11576` → cuotas `3858 + 3858 + 3860 = 11576`. ✔

> No usamos sistema francés (cuota fija por amortización con intereses decrecientes): para el mercado AR de retail es menos representativo y más difícil de explicar/testear. Si en el futuro se modela un préstamo bancario real, se evaluará agregarlo como una estrategia aparte.

## Deployment

- **Local:** `docker compose up -d postgres` + `npm run dev`.
- **Producción:** VPS (Hetzner CX22 o DigitalOcean) con Docker Compose: contenedores `app` (Next.js standalone) + `postgres` + reverse proxy (Caddy, TLS automático).
- **CI/CD:** GitHub Actions → lint + typecheck + test → `prisma generate` → build → push de imagen a `ghcr.io` → SSH al VPS → `prisma migrate deploy` → `docker compose up -d`.

### Dockerfile (puntos críticos de Prisma)

- Correr `npx prisma generate` en la etapa de build.
- Alpine necesita `RUN apk add --no-cache openssl`.
- Copiar `node_modules/.prisma` y `prisma/` al stage `runner`.
- `output: "standalone"` en `next.config.ts`.

Si falta cualquiera de los tres primeros, la app crashea en runtime con "Prisma Client did not initialize".

## docker-compose (desarrollo)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cuotas
      POSTGRES_USER: app
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]
volumes:
  postgres_data:
```

## Contexto de negocio relevante

- En Argentina (2026) **no existe** ya un programa estatal de cuotas subsidiadas ("Ahora 12"/"Cuota Simple" terminaron en 2025). Las cuotas las dan bancos/billeteras/retailers a tasa de mercado. Por eso `Purchase.interestRateMonthly` es opcional y el modelo **no asume 0% de interés**.
- El diferencial del producto es la vista consolidada multi-tarjeta y el "disponible neto de cuotas", algo que la competencia (Mercado Pago, Naranja X, Ualá, apps globales) no cubre bien.
