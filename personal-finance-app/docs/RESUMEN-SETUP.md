# Resumen de setup — commits 6e56c05 y b8681ca

Qué se hizo y por qué, en orden lógico.

---

## 1. Prisma 7 — diferencias importantes con lo que describe el SETUP.md

El `SETUP.md` fue escrito pensando en Prisma 5/6. Al correr `npm install prisma` se instaló **Prisma 7**, que cambió varias cosas:

**Schema sin `url`** — En Prisma 7, la URL de conexión ya no va en `schema.prisma` sino en `prisma.config.ts`:

```ts
// prisma.config.ts (generado automáticamente)
export default defineConfig({
  datasource: { url: process.env["DATABASE_URL"] },
});
```

**Driver adapter obligatorio** — Prisma 7 eliminó su motor Rust interno. Ahora se conecta a la DB vía un adapter de Node.js. Para PostgreSQL se usa `@prisma/adapter-pg` + `pg`:

```ts
// src/server/db/index.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
new PrismaClient({ adapter });
```

**Output del cliente generado** — El cliente se genera en `src/generated/prisma/` (no en `node_modules`). Está en `.gitignore` y se regenera con `npm install` gracias al script `postinstall: prisma generate`.

---

## 2. Modelo de datos (`prisma/schema.prisma`)

Seis modelos + un enum:

| Modelo | Propósito |
|---|---|
| `User` | Extendido con `defaultCurrency` y `monthlyIncomeCents` (BigInt) |
| `Session` / `Account` / `Verification` | Tablas de Better Auth, incluidas manualmente en el schema |
| `Card` | Tarjeta de crédito con `closingDay` y `dueDay` |
| `Purchase` | Compra en cuotas. Guarda el monto en centavos (`BigInt`) |
| `Installment` | Una cuota individual. Tiene `dueDate`, `amountCents` y `status` |
| `Category` | Categoría de gasto, por usuario |
| `ExchangeRate` | Tipo de cambio ARS/USD definido por el usuario |

```
User ──< Card ──< Purchase ──< Installment
              └──────────────<
```

Todo el dinero se guarda en **centavos como `BigInt`** — nunca floats (ver sección 5).

---

## 3. Better Auth — tres archivos

**`src/lib/auth.ts`** — config del servidor. Le pasa el cliente `prisma` al adapter:

```ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: { defaultCurrency: ..., monthlyIncomeCents: ... }
  },
});
```

Los `additionalFields` le dicen a Better Auth que esos campos del modelo `User` son parte del registro/sesión.

**`src/lib/auth-client.ts`** — cliente para el browser (React):

```ts
export const { signIn, signOut, signUp, useSession } = authClient;
```

**`src/app/api/auth/[...all]/route.ts`** — handler de Next.js. El `[...all]` captura cualquier subruta (`/api/auth/sign-in`, `/api/auth/get-session`, etc.):

```ts
export const { GET, POST } = toNextJsHandler(auth);
```

El endpoint `/api/auth/sign-up/email` fue verificado en vivo: devuelve token + usuario correctamente.

---

## 4. Validación (`src/lib/validation/`)

Dos schemas Zod que se usan tanto en el cliente (react-hook-form) como en el servidor (Server Actions):

- `card.ts` — valida nombre, brand, `last4` (exactamente 4 dígitos), `closingDay`, `dueDay`, currency.
- `purchase.ts` — valida `cardId`, descripción, monto (positivo, en unidades no centavos), cuotas (1–60), fecha.

La conversión de monto a centavos ocurre en la Server Action, no en el schema.

---

## 5. Utilidades de servidor (`src/server/lib/`)

### `money.ts` — centavos

```ts
currencyToCents(amount: number): bigint  // 1234.56 → 123456n
centsToCurrency(cents: bigint): number   // 123456n → 1234.56
formatMoney(cents: bigint, currency)     // 123456n → "$1.234,56"
```

Se usa `Intl.NumberFormat` con locale `es-AR` para el formato.

### `dates.ts` — wrappers de date-fns

Re-exporta las funciones más usadas (`addMonths`, `setDate`, `getDate`) y agrega formateadores en español para la UI.

### `installments.ts` — el algoritmo central

Dado una compra, genera las N filas de `Installment`. La lógica clave:

```
¿La compra cayó antes del cierre?
  Sí → la primera cuota vence el MES SIGUIENTE al cierre
  No → vence DOS MESES después
```

El reparto de centavos usa división entera con BigInt; el sobrante del redondeo lo absorbe la **última** cuota:

```
$100 en 3 cuotas → 33¢ | 33¢ | 34¢  (no 33.33... flotante)
```

---

## 6. Testing

**Vitest** para unit/component tests, **Playwright** para E2E.

`vitest.config.ts` configura jsdom como entorno (necesario para Testing Library) y resuelve el alias `@/*` para que los imports funcionen igual que en Next.js.

El primer test cubre `installments.ts` con 6 casos: cantidad de cuotas, conservación de centavos, redondeo, y los dos escenarios de fecha (antes/después del cierre). Corre sin DB.

---

## Lo que falta antes de la Fase 1

- `.env` tiene `BETTER_AUTH_SECRET` generado y `DATABASE_URL` configurada.
- La migración `init` está aplicada en la DB.
- `prisma generate` corre automáticamente en `npm install`.
- Podés arrancar con `npm run dev` + `docker compose up -d postgres`.
