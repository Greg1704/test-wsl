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
