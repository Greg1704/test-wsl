# BACKLOG — Ideas post-MVP

Features candidatas para después del MVP (Fases 1-6, ya en producción). No es un
compromiso de alcance ni un orden cerrado: es el pool de ideas priorizadas por
**relación valor/esfuerzo**, anotando qué reutiliza cada una de lo que ya existe.

> Convención: `RF-x` referencia un requerimiento de `REQUIREMENTS.md`. "Reutiliza"
> lista la infra existente sobre la que se apoya (menos esfuerzo, menos riesgo).

---

## Prioridad alta (mejor valor/esfuerzo)

### 1. Moneda "display" consolidada (RF-9.2)

Toggle *"ver todo en ARS"* en el dashboard: convierte los montos USD→ARS con el
tipo de cambio y muestra **un total consolidado** además de las columnas por moneda.

- **Por qué:** cierra la historia de multi-moneda (el diferencial declarado: "vista
  consolidada"). Es el paso natural después de multi-moneda por tarjeta.
- **Reutiliza:** el modelo `ExchangeRate` (ya existe, con `validFrom` fechado); el
  dashboard **ya bucketea por moneda**. Falta la capa de conversión + UI de tipo de
  cambio (cargar/editar) + el toggle.
- **Esfuerzo:** medio. Ojo con la regla de oro: nunca sumar montos de monedas
  distintas sin convertir explícitamente (ver `.claude/rules/dinero-y-fechas.md`).

### 2. Límite de crédito + utilización de la tarjeta

Agregar `creditLimit` a `Card` y mostrar cuánto del límite está comprometido en
cuotas futuras (barra de utilización).

- **Por qué:** extiende el eje de crédito; responde "¿me entra otra compra?".
- **Reutiliza:** el modelo `Card` (columna nueva) y las agregaciones de
  `Installment` que ya alimentan la proyección. Enchufa lindo con el **simulador**
  ("si comprás esto, quedás al 85% del límite").
- **Esfuerzo:** bajo-medio.

> **Estado: parcialmente implementado.** Columna `Card.creditLimitCents` (BigInt,
> centavos, moneda principal = `currencies[0]`), cálculo puro y testeado en
> `src/server/lib/card-utilization.ts`, barra inline por tarjeta (`CardItem`) y alerta
> en el dashboard (`CardLimitsAlert`, tarjetas ≥ 75% del límite). El "uso" es la suma de
> cuotas NO pagadas por tarjeta/moneda (`getCardsUtilization`). El límite es **requerido**
> al alta/edición de una tarjeta de crédito (Zod `superRefine`).
>
> **Pendiente:**
> - Integración con el **simulador** (proyectar la utilización pre-compra: "si comprás
>   esto, quedás al 92% del límite").
> - **Decisión de producto — "moneda principal" en tarjetas multi-moneda.** Hoy el límite
>   y la barra usan `currencies[0]`, que es solo el **primer elemento del array** (orden de
>   inserción, típicamente el `defaultCurrency` del usuario). No es una elección deliberada
>   y es **frágil**: reordenar las monedas al editar cambia cuál es la "principal". Además,
>   en una tarjeta ARS+USD real solo se muestra el límite de esa primera moneda; lo
>   comprometido en la otra no tiene barra. Hay que decidir entre: (a) hacerlo **explícito**
>   con un campo `Card.primaryCurrency` / selector "moneda del límite" en el form (barato,
>   quita la fragilidad), o (b) modelar un **límite por moneda** (columna extra o modelo
>   `CardCreditLimit`) y renderizar una barra por cada moneda de la tarjeta (lo correcto a
>   futuro, más esfuerzo). Para el MVP `currencies[0]` alcanza porque la mayoría de las
>   tarjetas son ARS-only.

---

## También vale la pena

### 3. Refinanciación / editar cuota individual (RF-4.5)

Editar el monto de una cuota puntual (caso AR: refinanciás el saldo de la tarjeta).

- **Reutiliza:** el modelo `Installment` ya soporta montos por cuota; las
  agregaciones se recalculan solas. Ya está anotado como Post-MVP en REQUIREMENTS.
- **Esfuerzo:** bajo (más una decisión de producto: ¿re-reparte el resto o toca solo esa cuota?).

### 4. Import de resumen (CSV/PDF)

Importador del resumen de tarjeta para evitar la carga manual (la fricción #1 de
estas apps).

- **Por qué:** la pieza de portfolio más impactante (parsing + matching + dedupe +
  tests exhaustivos — el testing es el diferencial del proyecto).
- **Reutiliza:** el pipeline de alta de compra/cuotas; el matching contra tarjetas
  existentes por `last4`.
- **Esfuerzo:** alto. Empezar por CSV (más simple y determinista) antes que PDF.

### 5. "Mejor día para comprar"

Dado `closingDay`/`dueDay` de la tarjeta, sugerir *"si comprás hoy pagás el 10/08;
si esperás 2 días, el 10/09"* (maximizar el float).

- **Reutiliza:** toda la lógica de ciclo ya está en `src/server/lib/installments.ts`
  (`generateInstallments` y el cálculo del primer vencimiento).
- **Esfuerzo:** bajo. Feature chica y "delightful", muy de mercado AR.

### 6. Liquidación de tarjetas ajenas

Ya existe `Card.owner` (tarjetas de terceros que se deben pagar). Falta el otro lado:
"cuánto te debe cada persona este mes por sus cuotas".

- **Reutiliza:** `Card.owner` + agregaciones de `Installment` por tarjeta/mes.
- **Esfuerzo:** medio. Cierra una feature que quedó a medio modelar.

### 7. Suscripciones / gastos recurrentes

Cargos mensuales automáticos (Netflix, Spotify…) que impactan el disponible neto sin
recargarlos a mano cada mes.

- **Reutiliza:** el eje de gastos no-crédito y el bucketing por mes de savings.
- **Esfuerzo:** medio (modelo de recurrencia + generación de los cargos del mes).

---

## Descartada por ahora (registro de la decisión)

- **Alertas de vencimiento (RF-10):** banner "cuotas que vencen en 3 días" + email.
  Alto valor y bajo esfuerzo (reutiliza el cron de `monthly-report` y el sistema de
  mails), pero el usuario la deja fuera del foco actual. Queda anotada para retomar.
