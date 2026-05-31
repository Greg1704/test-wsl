// Registro único de bancos conocidos. Lo usan el form de tarjetas (opciones del
// Select + color del modal) y la card (color de fondo). Agregar/quitar bancos o
// ajustar colores es solo editar esta lista.

export type BankStyle = {
  /** Valor canónico que se guarda en Card.bank. */
  value: string;
  /** Texto que se muestra en el Select. */
  label: string;
  /** Clases Tailwind para el fondo de la card (tinte suave + acento a la izquierda). */
  cardClass: string;
  /** Clases Tailwind para el fondo del modal (color plano, sin acento, más sólido). */
  modalClass: string;
  // icon?: LucideIcon  ← reservado para el ícono del banco (mejora futura)
};

export const KNOWN_BANKS: BankStyle[] = [
  { value: "Galicia", label: "Galicia", cardClass: "bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-500", modalClass: "bg-orange-100 dark:bg-orange-900/60" },
  { value: "Santander", label: "Santander", cardClass: "bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-600", modalClass: "bg-red-100 dark:bg-red-900/60" },
  { value: "BBVA", label: "BBVA", cardClass: "bg-sky-50 dark:bg-sky-950/30 border-l-4 border-l-sky-700", modalClass: "bg-sky-100 dark:bg-sky-900/60" },
  { value: "Macro", label: "Macro", cardClass: "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-800", modalClass: "bg-blue-100 dark:bg-blue-900/60" },
  { value: "Nación", label: "Banco Nación", cardClass: "bg-cyan-50 dark:bg-cyan-950/30 border-l-4 border-l-cyan-700", modalClass: "bg-cyan-100 dark:bg-cyan-900/60" },
  { value: "Brubank", label: "Brubank", cardClass: "bg-violet-50 dark:bg-violet-950/30 border-l-4 border-l-violet-600", modalClass: "bg-violet-100 dark:bg-violet-900/60" },
  { value: "Naranja X", label: "Naranja X", cardClass: "bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-600", modalClass: "bg-orange-100 dark:bg-orange-900/60" },
  { value: "Mercado Pago", label: "Mercado Pago", cardClass: "bg-sky-50 dark:bg-sky-950/30 border-l-4 border-l-sky-500", modalClass: "bg-sky-100 dark:bg-sky-900/60" },
];

/** Sentinel para la opción "Otro" del Select (no se persiste). */
export const OTHER_BANK = "__otro__";

/** Color por defecto del modal cuando no hay un banco conocido seleccionado. */
export const NEUTRAL_MODAL_CLASS = "bg-zinc-100 dark:bg-zinc-800/70";

export function findBank(name?: string | null): BankStyle | undefined {
  if (!name) return undefined;
  return KNOWN_BANKS.find((b) => b.value === name);
}
