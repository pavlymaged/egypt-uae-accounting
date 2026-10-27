import type { TranslationKey } from '../../i18n/en';
import { formatNumber } from '../../lib/money';
import { ratePercent, storedRate } from '../../lib/rates';
import { CURRENCIES, type Currency } from '../../types';
import type { FeeMethod, FeeRate } from './books';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export interface FeeTerms {
  fee_method: FeeMethod;
  fee_markup: string | null;
  fixed_fee_total: string | null;
  fixed_fee_currency: Currency | null;
}

export function findRate(rates: FeeRate[], markup: string | null): FeeRate | null {
  if (!markup) return null;
  const wanted = storedRate(markup);
  return rates.find((r) => storedRate(r.markup) === wanted) ?? null;
}

export function rateLabel(rate: FeeRate, t: Translate): string {
  return t('projects.markupOption', { markup: ratePercent(rate.markup), income: ratePercent(rate.on_income) });
}

export function feeSummary(terms: FeeTerms, instalments: number, rates: FeeRate[], t: Translate): string {
  if (terms.fee_method === 'percent' && terms.fee_markup) {
    const rate = findRate(rates, terms.fee_markup);
    return rate
      ? t('projects.fee.percent', { markup: ratePercent(rate.markup), income: ratePercent(rate.on_income) })
      : t('projects.fee.percentOnly', { markup: ratePercent(terms.fee_markup) });
  }
  if (terms.fee_method === 'fixed' && terms.fixed_fee_total && terms.fixed_fee_currency) {
    return t(instalments === 1 ? 'projects.fee.fixedOne' : 'projects.fee.fixed', {
      amount: formatNumber(terms.fixed_fee_total, terms.fixed_fee_currency),
      currency: terms.fixed_fee_currency,
      n: instalments,
    });
  }
  return t('projects.fee.none');
}

// Wraps every bare JSON number in quotes before parsing, so stored digits never pass through floating point.
function parseJsonKeepingDigits(text: string): unknown {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (match) {
        out += `"${match[0]}"`;
        i += match[0].length - 1;
        continue;
      }
    }
    out += ch;
  }
  return JSON.parse(out);
}

export interface SnapshotView extends FeeTerms {
  name: string;
  client_id: string | null;
  project_type: string | null;
  is_active: boolean | null;
  notes: string | null;
  milestones: { completion_percent: string; amount: string }[];
}

const asText = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function readSnapshot(text: string | null): SnapshotView | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = parseJsonKeepingDigits(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const method = asText(s.fee_method);
  const currency = asText(s.fixed_fee_currency);
  const milestones = Array.isArray(s.milestones) ? s.milestones : [];
  return {
    name: asText(s.name) ?? '',
    client_id: asText(s.client_id),
    project_type: asText(s.project_type),
    is_active: typeof s.is_active === 'boolean' ? s.is_active : null,
    notes: asText(s.notes),
    fee_method: method === 'percent' || method === 'fixed' ? method : 'none',
    fee_markup: asText(s.fee_markup),
    fixed_fee_total: asText(s.fixed_fee_total),
    fixed_fee_currency: currency && (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : null,
    milestones: milestones
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({ completion_percent: asText(m.completion_percent) ?? '', amount: asText(m.amount) ?? '' })),
  };
}
