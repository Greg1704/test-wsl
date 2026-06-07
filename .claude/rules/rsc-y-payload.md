# Regla: RSC y payload Server → Client

Cuando un **Server Component** pasa datos a un **Client Component** (`"use client"`),
esas props se **serializan** al payload RSC. Cuidá ese borde:

## Pasá DTOs mínimos, no objetos Prisma completos

- A un Client Component pasale **solo los campos que usa**, no el row entero de
  Prisma. Usá `Pick<Model, "campo1" | "campo2">` para mantener el tipado.
- Motivo: inflar el payload tiene un costo real. Con payloads grandes **y/o varias
  instancias del mismo Client Component en la página**, el serializador RSC (en dev)
  puede **dejar de renderizar** algunos nodos **sin lanzar error** (status 200, el
  resto de la página renderiza, pero el elemento no aparece en el DOM ni en el SSR).
  Es **dependiente de los datos**: con pocos datos anda, con muchos no — por eso no
  se reproduce con un usuario de prueba "vacío".

```tsx
// ✗ manda al cliente userId, createdAt, expirationDate, isActive… que no usa
<PurchaseFormDialog cards={cards} categories={categories} />

// ✓ solo lo que el form necesita
const dialogCards = cards.map((c) => ({
  id: c.id, name: c.name, bank: c.bank, last4: c.last4,
  currency: c.currency, closingDay: c.closingDay, dueDay: c.dueDay,
}));
<PurchaseFormDialog cards={dialogCards} categories={categories.map(c => ({ id: c.id, name: c.name }))} />
```

## No reutilices el mismo elemento JSX en varias posiciones

- No guardes un elemento de Client Component en una `const` y lo rendericés en dos
  lugares del árbol. Creá uno nuevo en cada lugar (una **función** que lo devuelva, o
  JSX inline). El elemento reutilizado tampoco se resuelve bien al serializar.

```tsx
// ✗ el mismo elemento en dos slots
const btn = <PurchaseFormDialog … />;
return <>{a && btn}{b && btn}</>;

// ✓ función: cada lugar crea su propio elemento
const renderBtn = () => <PurchaseFormDialog … />;
return <>{a && renderBtn()}{b && renderBtn()}</>;
```

## El return de una Server Action también cruza el borde

- El **valor que devuelve una Server Action** se serializa de vuelta al Client
  Component que la llamó — igual que las props Server→Client, pero en el sentido
  inverso. **Nunca devuelvas un row de Prisma crudo** desde una action: trae
  `Decimal` (ej. `interestRateMonthly`) y `BigInt` (ej. `totalAmountCents`), que
  **no son serializables** y rompen con *"Only plain objects can be passed to
  Client Components"*.
- Ocurre **aunque el cliente descarte el resultado** (`await createPurchase(...)`
  sin usar el retorno): la serialización pasa igual. Devolvé `void`, o un DTO
  mínimo y plano (`{ id }` como `string`).

```ts
// ✗ devuelve el objeto Prisma entero (Decimal + BigInt) → rompe el borde
return purchase;

// ✓ DTO mínimo y serializable (sirve para redirigir a /compras/:id)
return { id: purchase.id };
```

## Recordá además

- **`BigInt` no es serializable** a JSON: convertí a `string` en el borde (ver
  `.claude/rules/dinero-y-fechas.md`). Lo mismo aplica a `Decimal` de Prisma:
  convertí a `number`/`string` antes de cruzar.
- Para diagnosticar "un elemento no aparece y no hay error": reproducí con los
  **datos reales** del usuario (no uno nuevo), y compará el HTML del SSR vs el
  DOM hidratado.
