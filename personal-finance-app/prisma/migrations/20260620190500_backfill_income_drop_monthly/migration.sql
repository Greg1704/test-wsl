-- Backfill del ingreso legacy (User.monthlyIncomeCents) al modelo fechado IncomeEntry,
-- ANTES de dropear la columna. Cada usuario con ingreso > 0 obtiene una entrada en su
-- moneda principal, vigente desde el mes en que se creó la cuenta (aplica a todo mes).
INSERT INTO "IncomeEntry" ("id", "userId", "currency", "amountCents", "validFrom", "createdAt")
SELECT
  gen_random_uuid()::text,
  "id",
  "defaultCurrency",
  "monthlyIncomeCents",
  date_trunc('month', "createdAt")::date,
  now()
FROM "User"
WHERE "monthlyIncomeCents" > 0;

-- Columna deprecada: el ingreso vive ahora en IncomeEntry.
ALTER TABLE "User" DROP COLUMN "monthlyIncomeCents";
