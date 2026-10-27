import type { Currency } from '../types';

const THREE_DECIMAL: Currency[] = ['BHD', 'OMR'];

export function currencyDecimals(currency: Currency): number {
  return THREE_DECIMAL.includes(currency) ? 3 : 2;
}

export function isValidAmount(value: string, currency: Currency): boolean {
  const decimals = currencyDecimals(currency);
  return new RegExp(`^\\d{1,13}(\\.\\d{1,${decimals}})?$`).test(value.trim());
}

export function normalizeAmount(value: string): string {
  return value.trim().replace(/,/g, '');
}

// Groups the digits by text only. Extra stored digits are kept when they are not zeros, so nothing is hidden.
export function formatNumber(value: string | null | undefined, currency: Currency): string {
  const decimals = currencyDecimals(currency);
  const raw = (value ?? '0').trim() || '0';
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracRaw = ''] = unsigned.split('.');
  const intPart = (intPartRaw.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const kept = fracRaw.length > decimals ? fracRaw.slice(0, decimals) + fracRaw.slice(decimals).replace(/0+$/, '') : fracRaw;
  const frac = kept.padEnd(decimals, '0');
  return `${negative ? '-' : ''}${intPart}${frac ? `.${frac}` : ''}`;
}

export function formatAmount(value: string | null | undefined, currency: Currency): string {
  return `${currency} ${formatNumber(value, currency)}`;
}
