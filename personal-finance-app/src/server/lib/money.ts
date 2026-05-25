const ARS_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const USD_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function centsToCurrency(cents: bigint): number {
  return Number(cents) / 100;
}

export function currencyToCents(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

export function formatMoney(cents: bigint, currency: string = "ARS"): string {
  const amount = centsToCurrency(cents);
  return currency === "USD" ? USD_FORMATTER.format(amount) : ARS_FORMATTER.format(amount);
}
