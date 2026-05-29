# Regla: Datos y Prisma

- Cliente Prisma: usá **siempre el singleton** de `src/server/db/index.ts`. Nunca `new PrismaClient()` en otro lado.
- Migraciones: `npx prisma migrate dev --name <desc>` en desarrollo (genera SQL versionado en `prisma/migrations/`, que SÍ se commitea). En CI/prod: `npx prisma migrate deploy`. **Nunca `prisma db push` en producción.**
- Después de cambiar `schema.prisma`: corré la migración y `npx prisma generate`.
- Modelo de datos completo y su explicación: `docs/ARCHITECTURE.md`. Leerlo antes de tocar el schema.

## Cuotas: materializar, no calcular al vuelo

Al crear una `Purchase`, generá las N filas de `Installment` con `generateInstallments()` y guardalas en una **transacción**:

```ts
await prisma.$transaction(async (tx) => {
  const purchase = await tx.purchase.create({ data: { /* ... */ } });
  await tx.installment.createMany({
    data: generateInstallments({ /* ... */ }).map((c) => ({
      ...c, purchaseId: purchase.id, currency: purchase.currency,
    })),
  });
});
```

Materializar permite marcar cuotas como pagadas, editarlas y hacer agregaciones triviales:

```ts
prisma.installment.aggregate({
  _sum: { amountCents: true },
  where: { dueDate: { gte, lte }, purchase: { userId } },
});
```

## Modelos centrales (referencia rápida)

`User` · `Card` (closingDay, dueDay, currency, last4) · `Purchase` (totalAmountCents, totalInstallments, interestRateMonthly?) · `Installment` (installmentNumber, dueDate, amountCents, status) · `Category` · `ExchangeRate`.
