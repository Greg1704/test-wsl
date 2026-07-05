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

---

## También vale la pena

### 2. Refinanciación / editar cuota individual (RF-4.5)

Editar el monto de una cuota puntual (caso AR: refinanciás el saldo de la tarjeta).

- **Reutiliza:** el modelo `Installment` ya soporta montos por cuota; las
  agregaciones se recalculan solas. Ya está anotado como Post-MVP en REQUIREMENTS.
- **Esfuerzo:** bajo (más una decisión de producto: ¿re-reparte el resto o toca solo esa cuota?).

### 3. Import de resumen (CSV/PDF)

Importador del resumen de tarjeta para evitar la carga manual (la fricción #1 de
estas apps).

- **Por qué:** la pieza de portfolio más impactante (parsing + matching + dedupe +
  tests exhaustivos — el testing es el diferencial del proyecto).
- **Reutiliza:** el pipeline de alta de compra/cuotas; el matching contra tarjetas
  existentes por `last4`.
- **Esfuerzo:** alto. Empezar por CSV (más simple y determinista) antes que PDF.

### 4. "Mejor día para comprar"

Dado `closingDay`/`dueDay` de la tarjeta, sugerir *"si comprás hoy pagás el 10/08;
si esperás 2 días, el 10/09"* (maximizar el float).

- **Reutiliza:** toda la lógica de ciclo ya está en `src/server/lib/installments.ts`
  (`generateInstallments` y el cálculo del primer vencimiento).
- **Esfuerzo:** bajo. Feature chica y "delightful", muy de mercado AR.

### 5. Liquidación de tarjetas ajenas

Ya existe `Card.owner` (tarjetas de terceros que se deben pagar). Falta el otro lado:
"cuánto te debe cada persona este mes por sus cuotas".

- **Reutiliza:** `Card.owner` + agregaciones de `Installment` por tarjeta/mes.
- **Esfuerzo:** medio. Cierra una feature que quedó a medio modelar.

### 6. Suscripciones / gastos recurrentes

Cargos mensuales recurrentes (Netflix, Spotify…) que impactan el disponible neto sin
recargarlos a mano cada mes.

- **Reutiliza:** el eje de crédito (utilización, calendario) y el motor de ahorro
  (`computeSavings`), sin tocar la función pura.
- **Esfuerzo:** medio.

> **Estado: implementado.** Detalle técnico en `docs/ARCHITECTURE.md` → "Suscripciones /
> gastos recurrentes". Decisiones tomadas (se conservan acá como registro):
>
> Una suscripción es una **entidad hermana de `Purchase`**, no una compra: se paga por
> **crédito o débito** (efectivo/transferencia quedan fuera por ahora).
>
> **1. Modelo híbrido (definición + overrides dispersos).** No se materializa una fila por
> mes (eso exigiría un cron infinito). Dos tablas:
> - `Subscription` — la definición viva: `name`, `amountCents`/`currency`, `paymentMethod`
>   (`CREDIT | DEBIT`), `cardId?` (requerido si `CREDIT`), `firstChargeDate` (ancla de
>   recurrencia: 7 jun → 7 jul → …), `endDate?` (baja), `categoryId?`, `limitRate?`
>   (`Decimal(18,6)`, solo crédito en moneda ≠ principal, snapshot al crear).
> - `SubscriptionCharge` — override **disperso**, una fila **solo cuando el usuario toca un
>   mes**: `(subscriptionId, periodMonth)` único, `status` (`PAID | SKIPPED`),
>   `paidFromSavings`, `paidAt?`, `amountCentsOverride?`. Sin fila ⇒ mes **pendiente,
>   contado, al monto de la definición**. `SKIPPED` = "este mes no cuenta".
> - Función pura `expandSubscriptions(defs, overrides, from, to)` expande y aplica overrides
>   (caso borde: día 31 en febrero se clampea al último día). Todo BigInt, por moneda.
>
> **2. Ahorro: todo va a "tras cuotas" (`afterCents`), como una cuota más.** Aunque sea
> débito, el cargo se paga **en** su fecha (la suscripción sigue activa hasta ahí), no antes
> ⇒ no baja `before`. Marcado **manual** de pago/salteo (el servicio puede darse de baja o
> pagarse más tarde; no se auto-marca al pasar la fecha). Consecuencia elegante: el motor
> `computeSavings` **no cambia** — la capa de acción une los cobros **no pagados** del mes en
> `committedThisMonthCents` y los **pagados** en `savingsCuotas`.
>
> **3. Crédito: pesa en utilización y calendario vía cobros virtuales (NO se materializa).**
> Descartado crear una `Purchase` al pagar (nace siempre PAID ⇒ no aportaría a utilización ni
> a calendario futuro, y sumaba dedupe/reversa). En cambio se alimentan las funciones de
> crédito existentes con los cobros virtuales:
> - **Utilización** (`getCardsUtilization`): una suscripción **no** es como una compra en N
>   cuotas (que compromete todo el capital desde el día 1). Cada mes postea su propio cobro,
>   así que los meses futuros **aún no ocupan** el límite. Pesa solo por cobros con
>   `periodMonth ≤ mes actual` sin marca de pago (≈ el cobro corriente), convertidos con
>   `limitRate`. Reusa `utilizationPercent`/`convertCents`.
> - **Calendario**: ahí sí se muestran los cobros **futuros** (3-6 meses) como preview de
>   flujo, visualmente distintos (recurrentes/estimados) de las cuotas reales.
>
> **4. Subsección "Suscripciones" en el dashboard** (junto a crédito y ahorro): lista de
> suscripciones activas, % del ingreso que comprometen (dentro de cada moneda; consolidar
> multi-moneda espera a la feature de "moneda display" #1) y orden de mayor a menor costo.
>
> **5. CRUD** con botón "Gestionar suscripciones" (separado del de cuotas): crear/editar/
> borrar + ver 3-6 cobros futuros con toggles de pago/salteo por mes.

---

## Descartada por ahora (registro de la decisión)

- **Alertas de vencimiento (RF-10):** banner "cuotas que vencen en 3 días" + email.
  Alto valor y bajo esfuerzo (reutiliza el cron de `monthly-report` y el sistema de
  mails), pero el usuario la deja fuera del foco actual. Queda anotada para retomar.
