-- Tarjetas multi-moneda: reemplaza la columna única `currency` por `currencies`
-- (array), preservando el valor actual de cada tarjeta como su primera (y por ahora
-- única) moneda. Mismo ciclo (cierre/vencimiento) para todas las monedas del plástico.
ALTER TABLE "Card" ADD COLUMN "currencies" TEXT[] NOT NULL DEFAULT ARRAY['ARS']::TEXT[];

-- Backfill ANTES de dropear: la moneda actual pasa a ser la lista de monedas.
UPDATE "Card" SET "currencies" = ARRAY["currency"];

-- Columna deprecada: la moneda vive ahora en `currencies`.
ALTER TABLE "Card" DROP COLUMN "currency";
