/**
 * Onboarding de la ventana principal. Los 3 pasos básicos de alta: configurar el
 * ingreso mensual (RF-5.1), agregar una tarjeta (RF-2) y registrar una compra (RF-3).
 * Función pura (sin I/O): la decisión de qué mostrar se testea sin DB.
 */
export type OnboardingFlags = {
  hasIncome: boolean;
  hasCards: boolean;
  hasPurchases: boolean;
};

export type OnboardingStep = "income" | "cards" | "purchases";

/** Cantidad de pasos completados (0..3). */
export function completedSteps(flags: OnboardingFlags): number {
  return [flags.hasIncome, flags.hasCards, flags.hasPurchases].filter(Boolean).length;
}

/**
 * El próximo paso pendiente, en orden canónico (ingreso → tarjeta → compra), o
 * `null` si ya están los tres. Con 2 de 3 hechos es el ÚNICO que falta: por eso el
 * banner del dashboard lo usa para empujar al paso que resta.
 */
export function pendingStep(flags: OnboardingFlags): OnboardingStep | null {
  if (!flags.hasIncome) return "income";
  if (!flags.hasCards) return "cards";
  if (!flags.hasPurchases) return "purchases";
  return null;
}

/**
 * Qué mostrar en la ventana principal según el avance:
 * - 0–1 pasos ⇒ checklist de alta (en lugar del dashboard).
 * - 2–3 pasos ⇒ el dashboard (con banner del paso faltante si todavía queda uno).
 */
export function shouldShowChecklist(flags: OnboardingFlags): boolean {
  return completedSteps(flags) < 2;
}
