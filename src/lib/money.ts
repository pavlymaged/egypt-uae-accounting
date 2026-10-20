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

export function formatAmount(value: string | null | undefined, currency: Currency): string {
  const decimals = currencyDecimals(currency);
  const raw = (value ?? '0').trim() || '0';
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracRaw = ''] = unsigned.split('.');
  const intPart = (intPartRaw.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = fracRaw.length >= decimals ? fracRaw.slice(0, decimals) : fracRaw.padEnd(decimals, '0');
  return `${currency} ${negative ? '-' : ''}${intPart}${decimals > 0 ? `.${frac}` : ''}`;
}
