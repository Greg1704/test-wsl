// DTOs que el Server Component (`/simulador/page.tsx`) pasa al cliente. Solo números
// y strings (regla rsc-y-payload): nada de BigInt ni Date cruza el borde.

export type SimCard = {
  id: string;
  name: string;
  bank: string | null;
  last4: string | null;
  currencies: string[];
  closingDay: number;
  dueDay: number;
  /**
   * Utilización actual del límite (cuotas ya comprometidas / límite), en centavos como
   * string para no cruzar BigInt al cliente (regla rsc-y-payload). Presente SOLO si el
   * seguimiento de límites está activo y esta tarjeta tiene límite cargado; si no, la
   * sección de utilización del simulador no se muestra.
   */
  limit?: { usedCents: string; limitCents: string };
};

export type SimBaseline = {
  currency: string;
  cards: { id: string; name: string }[];
  /** Largo = monthLabels.length, ceros donde no hay cuotas. */
  committed: number[];
  byCard: Record<string, number>[];
};

/** Contexto común a todos los escenarios (baseline/ingreso/horizonte). */
export type ScenarioContext = {
  monthLabels: string[];
  startYear: number;
  startMonth: number; // 0-11
  defaultCurrency: string;
  /** Ingreso mensual en la moneda principal, o null si no está configurado. */
  income: number | null;
  baselines: SimBaseline[];
};
