/**
 * Agrupa cuotas por día de vencimiento, en orden cronológico. Lo usa la agenda del
 * calendario (RF-6.1). Función pura (sin I/O ni date-fns): se testea sin DB.
 *
 * La clave se arma con los componentes locales de la fecha (no ISO/UTC) para agrupar
 * por el mismo día calendario que se muestra. `dueDate` es `@db.Date` (sin hora).
 */
export function groupInstallmentsByDate<T extends { dueDate: Date }>(
  rows: T[]
): { date: Date; items: T[] }[] {
  const groups = new Map<string, { date: Date; items: T[] }>();

  for (const row of rows) {
    const d = row.dueDate;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const group = groups.get(key);
    if (group) group.items.push(row);
    else groups.set(key, { date: d, items: [row] });
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

/** Fila mínima que necesita la proyección: cuota + moneda + tarjeta de origen. */
export type ProjectionRow = {
  dueDate: Date;
  amountCents: bigint;
  currency: string;
  cardId: string;
  cardName: string;
};

export type ProjectionMonth = {
  month: Date; // primer día del mes (componentes locales)
  totalCents: bigint;
  byCard: Record<string, bigint>; // cardId → centavos del mes
};

export type ProjectionSeries = {
  currency: string;
  /** Tarjetas presentes en la serie, ordenadas por total comprometido (desc). */
  cards: { id: string; name: string }[];
  /** Exactamente `monthCount` meses, con ceros donde no hay cuotas. */
  months: ProjectionMonth[];
};

/**
 * Arma la serie mensual de compromisos para el gráfico de proyección del
 * dashboard: por moneda (nunca se mezclan, RF-9.1), `monthCount` meses desde
 * `fromMonth`, cada uno con su total y el desglose por tarjeta (la vista
 * consolidada multi-tarjeta). Pura (sin I/O ni date-fns): se testea sin DB.
 * Los meses se indexan con componentes locales, igual que `groupInstallmentsByDate`.
 */
export function buildProjection(
  rows: ProjectionRow[],
  fromMonth: Date,
  monthCount: number
): ProjectionSeries[] {
  const start = new Date(fromMonth.getFullYear(), fromMonth.getMonth(), 1);
  const monthIndex = (d: Date) =>
    (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());

  const emptyMonths = (): ProjectionMonth[] =>
    Array.from({ length: monthCount }, (_, i) => ({
      month: new Date(start.getFullYear(), start.getMonth() + i, 1),
      totalCents: 0n,
      byCard: {},
    }));

  const series = new Map<
    string,
    { months: ProjectionMonth[]; cardTotals: Map<string, { name: string; total: bigint }> }
  >();

  for (const row of rows) {
    const idx = monthIndex(row.dueDate);
    if (idx < 0 || idx >= monthCount) continue; // fuera del horizonte del gráfico

    let s = series.get(row.currency);
    if (!s) {
      s = { months: emptyMonths(), cardTotals: new Map() };
      series.set(row.currency, s);
    }

    const m = s.months[idx];
    m.totalCents += row.amountCents;
    m.byCard[row.cardId] = (m.byCard[row.cardId] ?? 0n) + row.amountCents;

    const t = s.cardTotals.get(row.cardId);
    if (t) t.total += row.amountCents;
    else s.cardTotals.set(row.cardId, { name: row.cardName, total: row.amountCents });
  }

  return Array.from(series.entries()).map(([currency, s]) => ({
    currency,
    cards: Array.from(s.cardTotals.entries())
      .sort(([, a], [, b]) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0))
      .map(([id, { name }]) => ({ id, name })),
    months: s.months,
  }));
}

/** Fila mínima para el desglose por categoría (la categoría puede ser null). */
export type CategoryBreakdownRow = {
  amountCents: bigint;
  currency: string;
  category: { id: string; name: string; color: string | null } | null;
};

export type CategoryBreakdown = {
  currency: string;
  /** Mayor monto primero; las compras sin categoría van en "Sin categoría". */
  slices: { id: string | null; name: string; color: string | null; amountCents: bigint }[];
};

/**
 * Agrupa cuotas del mes por categoría de su compra, separado por moneda
 * (RF-7.3, adelantado a Fase 3). Pura: se testea sin DB.
 */
export function buildCategoryBreakdown(rows: CategoryBreakdownRow[]): CategoryBreakdown[] {
  const byCurrency = new Map<
    string,
    Map<string | null, { name: string; color: string | null; amountCents: bigint }>
  >();

  for (const row of rows) {
    let slices = byCurrency.get(row.currency);
    if (!slices) {
      slices = new Map();
      byCurrency.set(row.currency, slices);
    }
    const key = row.category?.id ?? null;
    const slice = slices.get(key);
    if (slice) slice.amountCents += row.amountCents;
    else
      slices.set(key, {
        name: row.category?.name ?? "Sin categoría",
        color: row.category?.color ?? null,
        amountCents: row.amountCents,
      });
  }

  return Array.from(byCurrency.entries()).map(([currency, slices]) => ({
    currency,
    slices: Array.from(slices.entries())
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) =>
        b.amountCents > a.amountCents ? 1 : b.amountCents < a.amountCents ? -1 : 0
      ),
  }));
}

/**
 * Porcentaje del ingreso comprometido en cuotas, con 1 decimal (ej. 32.5).
 * `null` si no hay ingreso configurado (sin ingreso no hay porcentaje que mostrar).
 * Puede superar 100 si las cuotas exceden el ingreso. Aritmética entera (BigInt):
 * se escala a por-mil y se divide por 10 al final.
 */
export function percentOfIncome(
  committedCents: bigint,
  incomeCents: bigint | null
): number | null {
  if (incomeCents === null || incomeCents <= 0n) return null;
  return Number((committedCents * 1000n) / incomeCents) / 10;
}
