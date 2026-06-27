/** Etiquetas de medio de pago para la UI (español). */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CREDIT: "Crédito",
  DEBIT: "Débito",
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/**
 * Texto de "origen" de una compra para listados: el nombre de la tarjeta si la hay
 * (crédito/débito), o la etiqueta del medio de pago (transferencia/efectivo no tienen
 * tarjeta).
 */
export function purchaseSourceLabel(
  paymentMethod: string,
  card: { name: string } | null
): string {
  return card?.name ?? paymentMethodLabel(paymentMethod);
}
