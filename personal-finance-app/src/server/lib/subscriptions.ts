/**
 * Lógica de suscripciones / gastos recurrentes (BACKLOG #6). Funciones puras, sin I/O ni
 * date-fns: el server hace las queries y pasa datos planos; acá va la expansión de la
 * definición en cobros mes a mes, testeable sin DB.
 *
 * Modelo híbrido (ver docs/ARCHITECTURE.md → Suscripciones):
 *  - `Subscription` es la DEFINICIÓN viva (monto, moneda, medio, día de cobro, baja).
 *  - Los cobros de cada mes NO se materializan: se computan al vuelo con `expandSubscriptions`.
 *  - Solo se persisten las DESVIACIONES (`SubscriptionCharge`): marcar un mes pago o saltearlo.
 *    Sin override ⇒ el mes está PENDING, contado, al monto de la definición.
 *
 * Fechas construidas por componentes locales (año/mes/día): TZ-safe bajo el invariante de
 * runtime UTC del proyecto — igual que `buildSavingsProjection`/`buildProjection`. Toda la
 * aritmética de dinero es entera (BigInt).
 */

export type SubMethod = "CREDIT" | "DEBIT";

/** Estado computado de un cobro: PENDING si no hay override; PAID/SKIPPED si lo hay. */
export type OccurrenceStatus = "PENDING" | "PAID" | "SKIPPED";

/** Definición de suscripción (datos planos; `Decimal`/`BigInt` ya resueltos fuera de Prisma). */
export type SubscriptionDef = {
  id: string;
  name: string;
  amountCents: bigint;
  currency: string;
  paymentMethod: SubMethod;
  cardId: string | null;
  /** @db.Date → medianoche UTC; su día del mes define el día de cobro. */
  firstChargeDate: Date;
  /** Baja INCLUSIVE: activa hasta este mes (incluido). null = activa. */
  endDate: Date | null;
  /** Cotización snapshot (crédito en moneda ≠ principal); string como llega de Prisma. */
  limitRate: string | null;
};

/** Override disperso de un mes puntual (fila real en `SubscriptionCharge`). */
export type ChargeOverride = {
  subscriptionId: string;
  periodMonth: Date;
  status: "PAID" | "SKIPPED";
  paidFromSavings: boolean;
  amountCentsOverride: bigint | null;
};

/** Un cobro concreto de un mes, con su estado y monto ya resueltos. */
export type SubscriptionOccurrence = {
  subscriptionId: string;
  name: string;
  /** Primer día del mes al que aplica el cobro. */
  periodMonth: Date;
  /** Día de cobro de ese mes (clampeado al último día en meses cortos). */
  dueDate: Date;
  amountCents: bigint;
  currency: string;
  paymentMethod: SubMethod;
  cardId: string | null;
  limitRate: string | null;
  status: OccurrenceStatus;
  /** Solo significativo cuando `status === "PAID"`. */
  paidFromSavings: boolean;
};

/** Índice de mes calendario absoluto (componentes locales). Igual que en `savings.ts`. */
function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/**
 * Expande cada definición en sus cobros mensuales dentro de la ventana [fromMonth, toMonth]
 * (ambos inclusive, por mes calendario), aplicando los overrides. Por suscripción arranca en
 * `max(fromMonth, firstChargeDate)` y termina en `min(toMonth, endDate)` (baja inclusive).
 * El día de cobro es el de `firstChargeDate`, clampeado al último día en meses cortos
 * (ej. cobro el 31 → 28/29 de febrero). Los meses SKIPPED se devuelven igual (con su status)
 * para que la gestión pueda mostrarlos; los consumidores que no los quieran, los filtran.
 */
export function expandSubscriptions(
  subs: SubscriptionDef[],
  overrides: ChargeOverride[],
  fromMonth: Date,
  toMonth: Date
): SubscriptionOccurrence[] {
  const fromIdx = monthIndex(fromMonth);
  const toIdx = monthIndex(toMonth);

  // Lookup de overrides por (subId, índice de mes) para O(1) por cobro.
  const overrideByKey = new Map<string, ChargeOverride>();
  for (const o of overrides) {
    overrideByKey.set(`${o.subscriptionId}:${monthIndex(o.periodMonth)}`, o);
  }

  const out: SubscriptionOccurrence[] = [];
  for (const s of subs) {
    const billingDay = s.firstChargeDate.getDate();
    const startIdx = Math.max(fromIdx, monthIndex(s.firstChargeDate));
    const endIdx = s.endDate != null ? Math.min(toIdx, monthIndex(s.endDate)) : toIdx;

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const year = Math.floor(idx / 12);
      const month = idx % 12;
      // new Date(year, month + 1, 0) → último día del mes (día 0 del mes siguiente).
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const day = Math.min(billingDay, daysInMonth);
      const override = overrideByKey.get(`${s.id}:${idx}`);
      out.push({
        subscriptionId: s.id,
        name: s.name,
        periodMonth: new Date(year, month, 1),
        dueDate: new Date(year, month, day),
        amountCents: override?.amountCentsOverride ?? s.amountCents,
        currency: s.currency,
        paymentMethod: s.paymentMethod,
        cardId: s.cardId,
        limitRate: s.limitRate,
        status: override ? override.status : "PENDING",
        paidFromSavings: override?.paidFromSavings ?? true,
      });
    }
  }
  return out;
}
