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
