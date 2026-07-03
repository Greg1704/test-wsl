/**
 * Utilización de tarjeta: qué porción del límite de crédito está comprometida en
 * cuotas todavía no pagadas. Función pura y testeada (segundo eje del crédito, junto
 * con la proyección de flujo). Ver docs/BACKLOG.md → "Límite de crédito + utilización".
 *
 * El límite y el uso van SIEMPRE en la misma moneda (la principal de la tarjeta,
 * `currencies[0]`): nunca se comparan montos de monedas distintas (RF-9.1,
 * .claude/rules/dinero-y-fechas.md). Toda la aritmética es entera (BigInt).
 */

/** % del límite a partir del cual la barra pasa a ámbar (y el dashboard avisa). */
export const WARNING_THRESHOLD = 75;

export type UtilizationLevel = "ok" | "warning" | "over";

/**
 * Porcentaje del límite usado (`used / limit * 100`), con 1 decimal. Entero-safe:
 * multiplica antes de dividir para no perder precisión. Devuelve `0` si no hay un
 * límite útil (`<= 0`), evitando la división por cero.
 */
export function utilizationPercent(usedCents: bigint, limitCents: bigint): number {
  if (limitCents <= 0n) return 0;
  return Number((usedCents * 1000n) / limitCents) / 10;
}

/**
 * Clasifica el porcentaje para el color de la barra y la alerta del dashboard:
 * `over` (te pasaste del límite) → rojo; `warning` (≥ umbral) → ámbar; `ok` → normal.
 */
export function utilizationLevel(percent: number): UtilizationLevel {
  if (percent > 100) return "over";
  if (percent >= WARNING_THRESHOLD) return "warning";
  return "ok";
}

/**
 * Convierte un monto en centavos a la moneda del límite usando la cotización snapshot
 * de la compra (`Purchase.limitRate`: unidades de la moneda principal por 1 de la moneda
 * de la compra). Entero-safe: escala la tasa a millonésimos (Decimal(18,6)) y redondea al
 * centavo (medio hacia arriba). `rate` llega como string desde Prisma (Decimal no cruza el
 * borde). Toda la aritmética es BigInt (.claude/rules/dinero-y-fechas.md).
 */
export function convertCents(cents: bigint, rate: string): bigint {
  // "1234.567" → 1234567000 millonésimos, sin pasar por float.
  const [intPart, fracPart = ""] = rate.split(".");
  const micros = BigInt(intPart) * 1_000_000n + BigInt((fracPart + "000000").slice(0, 6));
  // round(cents * micros / 1e6): + medio divisor antes de la división entera.
  return (cents * micros + 500_000n) / 1_000_000n;
}

/** Proyección de utilización pre-compra (simulador): cómo queda el límite si se hace la compra. */
export type UtilizationProjection = {
  limitCents: bigint;
  /** Uso actual (cuotas ya comprometidas), en la moneda del límite. */
  beforeUsedCents: bigint;
  /** Uso tras sumar la compra simulada. */
  afterUsedCents: bigint;
  /** Lo que suma la compra, ya convertido a la moneda del límite. */
  addedCents: bigint;
  beforePercent: number;
  afterPercent: number;
  beforeLevel: UtilizationLevel;
  afterLevel: UtilizationLevel;
};

/**
 * Proyecta la utilización del límite si se concretara una compra hipotética (simulador,
 * eje del límite). Reusa la misma matemática que la barra real. La compra suma su total
 * comprometido; si su moneda difiere de la del límite, se convierte con `rate` (misma
 * cotización que pide el alta real). Devuelve `null` cuando hace falta convertir pero no
 * hay una tasa válida (el simulador muestra un aviso hasta que el usuario la ingrese).
 */
export function projectUtilization(input: {
  currentUsedCents: bigint;
  limitCents: bigint;
  /** Total de la compra simulada, en SU moneda (= suma de sus cuotas). */
  addedCents: bigint;
  /** La compra está en la misma moneda que el límite (no requiere conversión). */
  sameCurrency: boolean;
  /** Cotización (moneda del límite por 1 de la compra); requerida si `!sameCurrency`. */
  rate?: number;
}): UtilizationProjection | null {
  const { currentUsedCents, limitCents, addedCents, sameCurrency, rate } = input;

  let added: bigint;
  if (sameCurrency) {
    added = addedCents;
  } else if (rate != null && rate > 0) {
    added = convertCents(addedCents, String(rate));
  } else {
    return null; // falta la cotización para proyectar
  }

  const afterUsedCents = currentUsedCents + added;
  const beforePercent = utilizationPercent(currentUsedCents, limitCents);
  const afterPercent = utilizationPercent(afterUsedCents, limitCents);
  return {
    limitCents,
    beforeUsedCents: currentUsedCents,
    afterUsedCents,
    addedCents: added,
    beforePercent,
    afterPercent,
    beforeLevel: utilizationLevel(beforePercent),
    afterLevel: utilizationLevel(afterPercent),
  };
}
