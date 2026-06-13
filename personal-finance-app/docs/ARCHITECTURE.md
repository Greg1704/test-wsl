# ARCHITECTURE — CuotApp

Modelo de datos, decisiones técnicas y deployment. Leé esto antes de tocar `prisma/schema.prisma`.

## Visión general

App full stack en un solo repo Next.js (App Router): los Server Components y Server Actions son el "backend", los Client Components el "frontend". Persistencia en PostgreSQL vía Prisma. Auth con Better Auth. En **desarrollo** todo corre en Docker; en **producción** la app va a Vercel y la base a Neon (ver Deployment).

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
  interestRateMonthly     Decimal? @db.Decimal(8, 4)  // TEM derivada del recargo (no es input)
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

  // 1a) ¿En qué mes CIERRA el resumen donde cae la compra?
  const purchaseDay = getDate(purchaseDate);
  const statementClosingMonth = purchaseDay <= cardClosingDay
    ? purchaseDate                 // cierra este mes
    : addMonths(purchaseDate, 1);  // pasa al cierre del mes siguiente

  // 1b) El pago vence en el primer dueDay POSTERIOR al cierre: mismo mes si el
  //     vencimiento cae más tarde que el cierre, mes siguiente si cae antes/igual.
  const firstDueMonth = cardDueDay > cardClosingDay
    ? statementClosingMonth
    : addMonths(statementClosingMonth, 1);

  // 2) Reparto de centavos (el sobrante se reparte de a 1 en las primeras cuotas)
  const n = BigInt(totalInstallments);
  const baseCents = totalAmountCents / n;
  const remainder = Number(totalAmountCents - baseCents * n); // 0..N-1 centavos

  // 3) N filas
  return Array.from({ length: totalInstallments }, (_, i) => ({
    installmentNumber: i + 1,
    amountCents: i < remainder ? baseCents + 1n : baseCents,
    // nextBusinessDay corre el vencimiento al lunes si cae fin de semana.
    dueDate: nextBusinessDay(setDate(addMonths(firstDueMonth, i), cardDueDay)),
    status: "PENDING" as const,
  }));
}
```

La compra y sus cuotas se insertan en una transacción (ver `.claude/rules/datos-y-prisma.md`).

### Ajuste de día hábil (fin de semana)

Si el vencimiento de una cuota cae **sábado o domingo**, se corre al **lunes
siguiente** (`nextBusinessDay` en `src/server/lib/dates.ts`). Es la convención más
común de los bancos para la fecha de pago.

Los **feriados NO se contemplan** a propósito: en Argentina son impredecibles por
código (los "puente" turísticos se declaran por decreto cada año, sin fórmula fija)
y CuotApp es una **proyección de flujo de caja**, no el sistema de facturación del
banco. Las fechas son una estimación con precisión de ±1-2 días hábiles. Como las
fechas de cierre/vencimiento se usan siempre en la primera quincena del mes, tampoco
hay riesgo de desborde de día (29/30/31 en meses cortos).

### Zona horaria del runtime (invariante: el proceso corre en UTC)

**El proceso de Node DEBE correr en UTC.** Producción ya lo hace (los contenedores
Docker usan UTC por defecto); en desarrollo, asegurate de que el runtime también esté
en UTC (la mayoría de los entornos lo están; si tu máquina no, exportá `TZ=UTC` antes
de `npm run dev` / `npm test`).

Por qué es un invariante y no un detalle: las columnas `@db.Date` (fechas de
calendario, sin hora — `dueDate`, `purchaseDate`, `expirationDate`) vuelven del driver
como **medianoche UTC** (ej. `'2026-06-09'` → `2026-06-09T00:00:00.000Z`). Todo el
manejo date-only del código (`startOfToday`, `startOfMonth`/`monthRange`,
`computeDisplayStatus`, `groupInstallmentsByDate`, el `format` de date-fns para mostrar
el día) opera en **hora local del proceso**. Mientras local == UTC, ambos lados
coinciden y todo es correcto.

Si el proceso corriera en una TZ negativa (ej. AR, UTC−3), local y UTC se desfasan y
aparece un corrimiento de **−1 día** sistémico: una cuota que vence *hoy* se contaría
como vencida, el calendario mostraría cada vencimiento un día antes, y `monthRange`
dejaría afuera el día 1 del mes y se colaría el día 1 del siguiente. **No es un bug
mientras se respete el invariante UTC** — por eso no normalizamos cada cálculo a UTC
(implicaría `date-fns-tz` para el formateo, más complejidad). Lo fijamos como invariante
y lo blindamos con tests:

- `src/server/lib/installment-status.test.ts` — "vence hoy ≠ vencida" con `dueDate`
  UTC-midnight y un `now` con hora (el caso real).
- `src/server/lib/dates.test.ts` — `monthRange` incluye el día 1 / último día y
  excluye el día 1 del mes siguiente.

Esos tests **asumen runtime UTC**: bajo una TZ no-UTC fallan a propósito y delatan que
el proceso no está en UTC.

## Cálculo de cuotas con interés (RF-3.5)

**El usuario ingresa el total final (con recargo), no una tasa.** En el retail argentino el comercio informa el plan como **"N cuotas de $X"** o un **monto recargado**, nunca una tasa mensual. Modelamos exactamente eso: el alta de la compra toma el **monto original** (`totalAmount`) y, opcionalmente, el **total con recargo** (`financedTotal`). Sin recargo, ambos son iguales.

**Sistema: el total final se reparte en N cuotas iguales.**

```
financedTotalCents = financedTotal ? toCents(financedTotal) : originalCents
base   = financedTotalCents / N        // división entera BigInt
resto  = financedTotalCents - base * N
cuota[i] = (i < resto) ? base + 1 : base       // el sobrante va en las primeras
```

- El reparto usa la regla de redondeo de siempre (los centavos sobrantes se reparten de a **1 en las primeras cuotas**), de modo que la suma de las cuotas es **exactamente** `financedTotalCents` (al centavo). Toda la aritmética es entera (BigInt).
- `Purchase.totalAmountCents` guarda el **monto original**. El total financiado no se persiste como columna: es la **suma de las cuotas** (`Installment.amountCents`). El "recargo %" se deriva contra el original.
- **Sin `financedTotal` (o igual al monto) ⇒ sin recargo:** las cuotas reparten el monto original, idéntico al caso sin interés.

### TEM derivada (`impliedMonthlyRate`)

A partir de `(monto original, total financiado, N)` derivamos la **tasa efectiva mensual** implícita —solo para mostrarla— resolviendo por **bisección** la `i` que iguala el valor presente de las N cuotas iguales al monto original (**sistema francés**): `original = cuota · (1 − (1+i)^−N) / i`. Se guarda en `Purchase.interestRateMonthly` (que pasó de ser un *input* a ser un valor *derivado*). `0`/`null` si no hay recargo.

Ejemplo: $100,00 (`10000`) que el comercio ofrece en **3 cuotas de $38,59** → total financiado `11576` → cuotas `3859 + 3859 + 3858 = 11576`. ✔  TEM derivada ≈ 5 % mensual.

> No usamos `(1 + i)^N` sobre el total (interés compuesto sobre el capital completo): sobreestima fuertemente el costo porque asume que nunca se amortiza capital (un préstamo *bullet*), p. ej. 10 % mensual en 12 cuotas triplicaría el total. Al tomar el total final como input evitamos ese sesgo y coincidimos con lo que el usuario ve en la caja. La TEM derivada usa el sistema francés, que sí modela la amortización.

## Deployment

> **Postura actual (MVP):** la app se deploya en **Vercel** (la plataforma nativa de
> Next.js) con la base en **Neon** (Postgres serverless administrado). Docker queda
> **solo para desarrollo** (ver `docker-compose`, abajo). El camino VPS + Docker Compose
> + Caddy es la **opción a futuro** (sección al final): si la app crece y justifica un
> servidor propio, ya está documentado y el `Dockerfile` de producción existe para ese día.

- **Local:** `docker compose up -d postgres` + `npm run dev`.
- **Producción:** Vercel (app) + Neon (Postgres).

### Por qué Vercel + Neon ahora

- **Costo $0** para un proyecto de portfolio (Vercel tier Hobby + Neon tier gratis).
- **Cero operación:** ni servidor que parchear, ni TLS que renovar, ni backups manuales
  (Neon hace *point-in-time restore*). El foco queda en el producto, no en la infra.
- **DX nativa de Next:** build, HTTPS y un dominio `*.vercel.app` salen de fábrica; cada
  Pull Request genera un **deploy preview** con su propia URL (útil para portfolio y para
  revisar features antes de mergear).

### Cómo corre (modelo mental)

En Vercel **no hay un contenedor de larga vida**: cada Server Component / Server Action se
ejecuta como **función serverless** efímera (se levanta por request y se apaga). Eso cambia
dos cosas respecto del modelo Docker:

```
Browser ──> Vercel (Next.js: RSC + Server Actions como funciones serverless)
                ──> Prisma (adapter-pg, conexión POOLED) ──> Neon Postgres
                         │
                         └── Better Auth (sesión por cookie)
```

- **Conexiones a Postgres (pooling).** Muchas funciones efímeras abren muchas conexiones
  cortas y Postgres tiene un límite bajo. Por eso en prod `DATABASE_URL` apunta al endpoint
  **pooled** de Neon (PgBouncer), y las **migraciones** (DDL) usan el endpoint **directo**
  vía `DIRECT_URL`. El singleton (`src/server/db/index.ts`) **no cambia**: sigue pasando
  `DATABASE_URL` al `PrismaPg`; solo cambia a qué endpoint apunta esa URL en prod.
  *(Optimización futura opcional: `@prisma/adapter-neon` usa el driver serverless de Neon
  por WebSocket y baja la latencia de cold start; innecesario para el MVP.)*
- **Runtime en UTC.** Vercel corre las funciones en UTC → respeta el invariante de zona
  horaria del proyecto (ver arriba) sin configuración extra.
- **Versión de Postgres.** Usar **Postgres 16** en Neon, igual que el `postgres:16-alpine`
  del `docker-compose` de dev → paridad dev/prod (RNF-4.3).
- **Región.** Poné la función de Vercel y la base de Neon en la **misma región**: Vercel
  Hobby corre las funciones en `iad1` (US East), así que la base va en **AWS `us-east-1`**.
  Importa porque cada request le pega varias veces a la DB; ese ida y vuelta DB↔función es
  el que infla el TTFB (RNF-3.1), no el viaje único usuario↔servidor. *(Optimización futura
  para usuarios AR: mover **ambos** a São Paulo —Vercel `gru1` + Neon `sa-east-1`—; nunca
  uno solo.)*

### Variables de entorno en producción

En Vercel → *Project Settings → Environment Variables* (marcadas para *Production*):

| Variable | Valor | Para qué |
|---|---|---|
| `DATABASE_URL` | endpoint **pooled** de Neon | runtime (lo usa el adapter) |
| `DIRECT_URL` | endpoint **directo** de Neon | migraciones (`prisma migrate deploy`) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (uno nuevo, distinto al de dev) | sesiones |
| `BETTER_AUTH_URL` | URL de producción (ej. `https://cuotapp.vercel.app`) | Better Auth |
| `NEXT_PUBLIC_APP_URL` | misma URL de producción | auth client en el browser |

`prisma.config.ts` debe usar `DIRECT_URL` para migrar, con fallback a `DATABASE_URL` en dev
(donde no existe el split pooled/directo): `url: process.env.DIRECT_URL ?? process.env.DATABASE_URL`.

### Migraciones en el deploy (RNF-10.3)

`prisma generate` ya corre en `postinstall`. Para aplicar las migraciones **antes** de servir
la versión nueva, el **Build Command** de Vercel corre `prisma migrate deploy` (contra
`DIRECT_URL`) y recién después buildea:

```
prisma migrate deploy && next build
```

Vercel solo promueve el deploy a producción si el build (con la migración incluida) terminó
OK, así que la versión nueva nunca arranca contra un schema sin migrar. `migrate deploy` es
idempotente (solo aplica lo pendiente) → RNF-10.2. *(Alternativa con más control de orden:
correr `migrate deploy` en un job de GitHub Actions previo al deploy; para el MVP el Build
Command alcanza.)*

### CI (GitHub Actions, Fase 5)

GitHub Actions queda como **portón de calidad** (no buildea imagen ni deploya): en cada push
a `main` y cada PR corre `typecheck`, `lint`, `test` y `build` (RNF-6.2). El **build y el
deploy los hace Vercel** al detectar el push. Son dos engranajes separados: CI verde por un
lado, deploy de Vercel por otro.

---

### Opción a futuro: VPS + Docker Compose

Si la app crece y conviene un servidor propio (más control, sin límites de serverless, costo
fijo), el camino es VPS (Hetzner CX22 o similar) con Docker Compose: contenedores `app`
(Next.js standalone) + `postgres` + reverse proxy (Caddy, TLS automático), con CI/CD que
pushea la imagen a `ghcr.io` y hace `prisma migrate deploy` + `docker compose up -d` por SSH.
El `Dockerfile` de producción (multi-stage, standalone) **ya existe** en el repo para ese día.

**Dockerfile de producción — puntos críticos de Prisma** (para cuando se use):
- Correr `npx prisma generate` en la etapa de build.
- Alpine necesita `RUN apk add --no-cache openssl`.
- Copiar `node_modules/.prisma` y `prisma/` al stage `runner`.
- `output: "standalone"` en `next.config.ts`.

Si falta cualquiera de los tres primeros, la app crashea en runtime con "Prisma Client did not initialize".

## docker-compose (solo desarrollo)

> Docker es la herramienta de **desarrollo** (base local + paridad de entorno + E2E). El
> deploy de producción es Vercel + Neon (ver Deployment), no usa este compose.

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
