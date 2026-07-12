/**
 * Lógica del ahorro (RF-ahorros). Funciones puras, sin I/O ni date-fns: el server
 * hace las queries y pasa datos planos; acá va toda la aritmética, testeable sin DB.
 *
 * Modelo de 2 ejes (ver docs/ARCHITECTURE.md):
 *  - El ahorro es un STOCK acumulado que crece con el ingreso (al inicio de cada mes)
 *    y se reduce con los gastos no-crédito (débito/transferencia/efectivo) y con las
 *    cuotas que el usuario marca como "pagadas desde el ahorro".
 *  - No es una columna mutable: se computa al leer desde un ANCLA (saldo declarado a
 *    una fecha) + ingresos − gastos, igual que `computeDisplayStatus` computa OVERDUE.
 *
 * Toda la aritmética es entera (BigInt). El bucketing por mes usa año/mes calendario
 * (componentes locales, no timestamps) → TZ-safe, igual que `buildProjection`.
 */

/** Índice de mes calendario absoluto (componentes locales). Mismo criterio que el dashboard. */
function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/** Ingreso mensual fechado por vigencia (una moneda). */
export type IncomeEntryInput = {
  amountCents: bigint;
  validFrom: Date;
};

/** Ancla del ahorro: saldo declarado por el usuario a la fecha `asOf` (una moneda). */
export type SavingsAnchor = {
  amountCents: bigint;
  asOf: Date;
};

export type SavingsInput = {
  /** Ancla del ahorro, o `null` si el usuario no declaró saldo (se asume 0). */
  anchor: SavingsAnchor | null;
  /** Entradas de ingreso de la moneda (cualquier orden). */
  incomeEntries: IncomeEntryInput[];
  /** Gastos no-crédito de la moneda (débito/transferencia/efectivo), por fecha de compra. */
  nonCreditExpenses: { purchaseDate: Date; amountCents: bigint }[];
  /** Cuotas de crédito marcadas pagadas-desde-ahorros, por fecha de pago. */
  savingsCuotas: { paidAt: Date; amountCents: bigint }[];
  /** Mes objetivo (cualquier día; se usa su mes calendario). */
  month: Date;
  /**
   * Cuotas/suscripciones que vencen en `month` y siguen SIN pagar (PENDING/OVERDUE). Es lo único
   * que el "tras cuotas" resta sobre el saldo real: lo ya pagado desde ahorros ya bajó
   * `currentReal`, y lo pagado sin ahorros no sale del ahorro — ninguno se vuelve a restar. Así
   * se evita el doble conteo de las cuotas pagadas-desde-ahorros previas al ancla, que el saldo
   * declarado ya refleja. Ver docs/ARCHITECTURE.md → Ahorros.
   */
  pendingThisMonthCents: bigint;
};

export type SavingsOverview = {
  /** Ahorro disponible este mes ANTES de pagar las cuotas del mes. */
  beforeCents: bigint;
  /** Proyección: ahorro si pagás lo que FALTA del mes desde el ahorro. Lo ya pagado sin ahorros
   *  no lo reduce; lo ya pagado desde ahorros ya bajó `currentReal`. */
  afterCents: bigint;
  /** Saldo real a hoy: descuenta las cuotas/suscripciones del mes ya marcadas pagadas-desde-ahorros. */
  currentRealCents: bigint;
};

/**
 * Ingreso vigente para un mes: la entrada con mayor `validFrom <= month`. Si no hay
 * ninguna vigente (mes anterior a la primera entrada), devuelve `0n`. Así los meses
 * pasados conservan su valor histórico y los nuevos toman el último configurado.
 */
export function incomeForMonth(entries: IncomeEntryInput[], month: Date): bigint {
  const target = monthIndex(month);
  let best: IncomeEntryInput | null = null;
  let bestIdx = -Infinity;
  for (const e of entries) {
    const idx = monthIndex(e.validFrom);
    if (idx <= target && idx > bestIdx) {
      best = e;
      bestIdx = idx;
    }
  }
  return best?.amountCents ?? 0n;
}

/**
 * Computa el ahorro de una moneda para el mes objetivo: `before` (antes de las cuotas
 * del mes), `after` (proyección restando lo que FALTA del mes, sin lo ya pagado sin ahorros)
 * y `currentReal` (saldo real, descontando lo del mes ya pagado-desde-ahorros).
 *
 * Acumula mes a mes desde el ancla: hacia adelante suma `ingreso − gastos no-crédito −
 * cuotas-desde-ahorros`; hacia atrás (navegar a un mes previo al ancla) lo resta. La
 * actividad del propio mes del ancla NO se cuenta (el saldo declarado ya la refleja).
 * Sin ancla, arranca de 0 desde el primer mes con actividad.
 */
export function computeSavings(input: SavingsInput): SavingsOverview {
  const {
    anchor,
    incomeEntries,
    nonCreditExpenses,
    savingsCuotas,
    month,
    pendingThisMonthCents,
  } = input;

  const targetIdx = monthIndex(month);

  // Ingreso vigente para un índice de mes (reusa la regla de `incomeForMonth`).
  const incomeAt = (idx: number): bigint => {
    let best = 0n;
    let bestIdx = -Infinity;
    for (const e of incomeEntries) {
      const eIdx = monthIndex(e.validFrom);
      if (eIdx <= idx && eIdx > bestIdx) {
        best = e.amountCents;
        bestIdx = eIdx;
      }
    }
    return best;
  };

  // Punto base: el ANCLA es el saldo declarado a la fecha `asOf` (un día puntual). El
  // ingreso del mes del ancla ya está reflejado en ese saldo (llega a inicio de mes ≤
  // asOf), pero los gastos/cuotas POSTERIORES a `asOf` —aunque caigan el mismo mes—
  // todavía no: por eso el ingreso se cuenta por mes (excluyendo el del ancla) y los
  // gastos/cuotas por FECHA (desde `asOf`). Sin ancla: arranca de 0 desde el primer mes.
  let anchorIdx: number;
  let baseAmount: bigint;
  let sinceDate: Date;
  if (anchor) {
    anchorIdx = monthIndex(anchor.asOf);
    baseAmount = anchor.amountCents;
    sinceDate = anchor.asOf;
  } else {
    const activity = [
      ...incomeEntries.map((e) => monthIndex(e.validFrom)),
      ...nonCreditExpenses.map((e) => monthIndex(e.purchaseDate)),
      ...savingsCuotas.map((c) => monthIndex(c.paidAt)),
    ];
    baseAmount = 0n;
    // anchorIdx − 1: el ingreso se cuenta desde el primer mes con actividad.
    anchorIdx = (activity.length > 0 ? Math.min(...activity) : targetIdx) - 1;
    sinceDate = new Date(-8640000000000000); // sin ancla: cuenta todo desde el inicio
  }

  // Ingreso acumulado entre el mes del ancla (excluido) y el objetivo. Hacia atrás
  // (navegar a un mes previo al ancla) lo resta. Los gastos/cuotas pre-ancla se asumen
  // ya reflejados en el saldo declarado (limitación documentada para meses pasados).
  let incomeContribution = 0n;
  if (targetIdx >= anchorIdx) {
    for (let m = anchorIdx + 1; m <= targetIdx; m++) incomeContribution += incomeAt(m);
  } else {
    for (let m = targetIdx + 1; m <= anchorIdx; m++) incomeContribution -= incomeAt(m);
  }

  // Gastos no-crédito desde `asOf` hasta el mes objetivo (inclusive): salen del ahorro
  // al instante, así que cuentan también en el "antes de cuotas".
  let expenseSum = 0n;
  for (const e of nonCreditExpenses) {
    if (e.purchaseDate >= sinceDate && monthIndex(e.purchaseDate) <= targetIdx) {
      expenseSum += e.amountCents;
    }
  }
  // Cuotas pagadas-desde-ahorros desde `asOf`. Separamos las del propio mes objetivo:
  // el "antes de cuotas" no descuenta ninguna cuota del mes; el saldo real sí las que
  // ya se marcaron pagadas.
  let cuotaSumBeforeTarget = 0n;
  let cuotaSumThisMonth = 0n;
  for (const c of savingsCuotas) {
    if (c.paidAt < sinceDate) continue;
    const idx = monthIndex(c.paidAt);
    if (idx < targetIdx) cuotaSumBeforeTarget += c.amountCents;
    else if (idx === targetIdx) cuotaSumThisMonth += c.amountCents;
  }

  const beforeCents = baseAmount + incomeContribution - expenseSum - cuotaSumBeforeTarget;
  const currentRealCents = beforeCents - cuotaSumThisMonth;
  // "Tras cuotas": parte del saldo REAL (que ya descontó lo pagado-desde-ahorros del mes) y le
  // resta solo lo que FALTA pagar. Lo ya pagado no se vuelve a restar → evita el doble conteo de
  // las cuotas pagadas-desde-ahorros previas al ancla (que el saldo declarado ya refleja). Con
  // todo pagado, pending = 0 ⇒ afterCents == currentRealCents.
  const afterCents = currentRealCents - pendingThisMonthCents;

  return { beforeCents, afterCents, currentRealCents };
}

/** Un mes de la proyección del ahorro: fecha + saldo disponible proyectado. */
export type SavingsProjectionMonth = { month: Date; beforeCents: bigint };

/**
 * Serie del ahorro disponible (`beforeCents`) proyectado `months` meses desde
 * `fromMonth`, para el gráfico de tendencia del stock. Reusa `computeSavings` por
 * mes (las cuotas comprometidas no entran: la proyección es del saldo disponible,
 * no del "después de cuotas"). Pura y testeable.
 */
export function buildSavingsProjection(
  input: Omit<SavingsInput, "month" | "pendingThisMonthCents">,
  fromMonth: Date,
  months: number
): SavingsProjectionMonth[] {
  return Array.from({ length: months }, (_, i) => {
    const month = new Date(fromMonth.getFullYear(), fromMonth.getMonth() + i, 1);
    const { beforeCents } = computeSavings({
      ...input,
      month,
      pendingThisMonthCents: 0n,
    });
    return { month, beforeCents };
  });
}
