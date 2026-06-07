# Regla: Dinero y fechas (crítico)

## Dinero — SIEMPRE enteros en centavos (BigInt)

- Guardá montos como **centavos en `BigInt`** → columna `bigint` de Postgres. `$1.234,56` = `123456n`.
- **PROHIBIDO** `Float`/`double precision`/`number` de JS para dinero: producen errores de redondeo.
- Hacé la aritmética con `BigInt`. Formateá **solo en la capa de presentación** con `Intl.NumberFormat`.
- `BigInt` no es serializable a JSON: al pasar de Server a Client Component, convertí a `string` en el borde.
- Multi-moneda: cada monto lleva su `currency` (`"ARS"` | `"USD"`). **Nunca sumes montos de monedas distintas.** Para vistas consolidadas, convertí usando el modelo `ExchangeRate`.

## Reparto de cuotas (redondeo)

Al dividir un total en N cuotas, los centavos del resto se reparten de a **1 entre las primeras** cuotas (como los bancos), para que la suma sea exacta sin que la última cuota se despegue:

```
base = total / N           (división entera BigInt)
resto = total - base * N    (0..N-1 centavos)
cuota[i] = (i < resto) ? base + 1 : base
```

Ejemplo: $100,00 (10000) en 3 → 3334 + 3333 + 3333 = 10000. ✔  ($200 en 12 → 8 cuotas de 1667 + 4 de 1666, diferencia de 1 centavo, no de 8.)

## Fechas

- Usá **date-fns** (no Moment, no Luxon salvo timezones complejos).
- Las fechas de vencimiento de cuota se calculan desde el **ciclo de la tarjeta** (`closingDay` + `dueDay`).
- Guardá fechas de calendario como `@db.Date` (sin hora) para evitar bugs de timezone.
- Lógica de "¿la compra entra en este cierre o en el siguiente?": ver `src/server/lib/installments.ts`.
