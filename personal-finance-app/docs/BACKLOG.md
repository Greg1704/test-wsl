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

> **Estado: implementado.** Seguimiento **opt-in** por usuario (`User.trackCreditLimits`,
> toggle en Configuración; apagado por defecto para no forzar el problema). Con el
> seguimiento activo:
> - El límite (`Card.creditLimitCents`) es **opcional por tarjeta** y se carga SIEMPRE en la
>   **moneda principal del usuario** (`User.defaultCurrency`), no en la de la tarjeta. Esto
>   resuelve la fragilidad de `currencies[0]`: hay un único tope y una única moneda de límite.
> - Las compras a crédito en **otra moneda** que la principal piden la **cotización al
>   confirmar** (modal de conversión en `PurchaseFormDialog`), que se guarda como snapshot
>   inmutable en `Purchase.limitRate` (unidades de la principal por 1 de la moneda de la
>   compra) — igual que hace un banco: fija el monto convertido al momento del gasto.
> - `getCardsUtilization` computa el uso en la moneda principal sumando las cuotas no pagadas
>   y convirtiendo las de otra moneda con su `limitRate`. Cálculo puro/testeado
>   (`utilizationPercent`, `utilizationLevel`, `convertCents`), barra inline por tarjeta y
>   alerta ≥ 75% en el dashboard.
>
> **Decisión de "moneda principal" (resuelta):** en vez de anclar el límite a la moneda de
> la tarjeta (frágil) o modelar un límite por moneda (caro), el límite es un **tope único en
> la moneda del usuario** y todo lo demás se convierte hacia él con cotización snapshot. Caso
> aceptado: una tarjeta USD-only con usuario ARS tendría límite en ARS y toda compra pediría
> conversión (poco frecuente en AR).
>
> **Integración con el simulador (hecha):** al simular una compra sobre una tarjeta con
> límite, el simulador proyecta la utilización **antes → después** ("quedás al 92% del
> límite"), con la misma barra/colores que Tarjetas, en modo plan único y en la comparación
> A vs B. Lógica pura `projectUtilization` (reusa `convertCents`/`utilizationPercent`). Si la
> compra simulada es en otra moneda que el límite, el simulador **pide la cotización** (un
> input, opción A) para convertirla — mismo criterio que el alta real.
>
> **Pendiente:**
> - Compras USD **previas** a la feature (sin `limitRate`) se **excluyen** del uso (no se
>   puede inventar la tasa). A futuro: ofrecer cargar la cotización retroactiva.

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
