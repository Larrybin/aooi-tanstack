const CURRENCY_PREFIXES: Record<string, string> = {
  USD: '$',
  EUR: '€',
  CNY: '¥',
};

export function formatPaymentAmountCents(
  amountInCents: number | null | undefined,
  currency: string | null | undefined
): string {
  const normalizedCurrency = (currency || 'USD').toUpperCase();
  const prefix =
    CURRENCY_PREFIXES[normalizedCurrency] ?? `${normalizedCurrency} `;

  return `${prefix}${(amountInCents ?? 0) / 100}`;
}
