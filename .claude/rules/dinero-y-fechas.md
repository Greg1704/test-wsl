# Regla: Dinero y fechas (crítico)

## Dinero — SIEMPRE enteros en centavos (BigInt)

- Guardá montos como **centavos en `BigInt`** → columna `bigint` de Postgres. `$1.234,56` = `123456n`.
- **PROHIBIDO** `Float`/`double precision`/`number` de JS para dinero: producen errores de redondeo.
- Hacé la aritmética con `BigInt`. Formateá **solo en la capa de presentación** con `Intl.NumberFormat`.
- `BigInt` no es serializable a JSON: al pasar de Server a Client Component, convertí a `string` en el borde.
- Multi-moneda: cada monto lleva su `currency` (`"ARS"` | `"USD"`). **Nunca sumes montos de monedas distintas.** Para vistas consolidadas, convertí usando el modelo `ExchangeRate`.

## Reparto de cuotas (redondeo)

Al dividir un total en N cuotas, el resto se asigna a la **última** cuota para que la suma sea exacta:

```
base = total / N           (división entera BigInt)
resto = total - base * N
cuota[i] = (i === N-1) ? base + resto : base
```

Ejemplo: $100,00 (10000) en 3 → 3333 + 3333 + 3334 = 10000. ✔

## Fechas

- Usá **date-fns** (no Moment, no Luxon salvo timezones complejos).
- Las fechas de vencimiento de cuota se calculan desde el **ciclo de la tarjeta** (`closingDay` + `dueDay`).
- Guardá fechas de calendario como `@db.Date` (sin hora) para evitar bugs de timezone.
- Lógica de "¿la compra entra en este cierre o en el siguiente?": ver `src/server/lib/installments.ts`.
