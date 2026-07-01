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
