/**
 * Formateo de montos para la capa de presentación del CLIENTE (charts, tooltips,
 * ejes), donde los valores ya cruzaron el borde RSC como `number`. El dinero
 * "real" sigue siendo BigInt en centavos y se formatea en el server con
 * `src/server/lib/money.ts`; acá solo se visualizan números ya convertidos.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      ...(compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2 }),
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** "$ 1.234,56" — para tooltips y valores puntuales. */
export function formatAmount(value: number, currency: string): string {
  return formatterFor(currency, false).format(value);
}

/** "$ 1,2 M" — para ejes y espacios chicos (notación compacta). */
export function formatCompactAmount(value: number, currency: string): string {
  return formatterFor(currency, true).format(value);
}
