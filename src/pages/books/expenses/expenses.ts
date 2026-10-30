import { toUnits, fromUnits } from '../../../lib/decimal';
import { currencyDecimals, normalizeAmount } from '../../../lib/money';
import type { Currency } from '../../../types';
import type { CashAccount } from '../books';
import { WORKFLOW_COLUMNS, type EntryWorkflow } from '../entries/entries';

export const MAX_LINES = 500;

export interface ExpenseBatch extends EntryWorkflow {
  description: string | null;
  line_count: number;
  base_total: string | null;
}

export const BATCH_COLUMNS = `${WORKFLOW_COLUMNS}, description, line_count, base_total:base_total::text`;

export interface ExpenseLine {
  entry_id: string;
  line_no: number;
  line_date: string;
  project_id: string;
  project_code: string;
  project_name: string;
  is_operation: boolean;
  account_id: string;
  account_code: string;
  account_name: string;
  category: string;
  category_name: string | null;
  item_code: number;
  item_name: string | null;
  item_name_ar: string | null;
  description: string;
  is_return: boolean;
  amount: string;
  currency: Currency;
  rate: string | null;
  base_amount: string | null;
  receipt_link: string | null;
  dup_confirmed: boolean;
}

export const LINE_COLUMNS = [
  'entry_id, line_no, line_date, project_id, project_code, project_name, is_operation, account_id, account_code, account_name',
  'category, category_name, item_code, item_name, item_name_ar, description, is_return',
  'amount:amount::text, currency, rate:rate::text, base_amount:base_amount::text, receipt_link, dup_confirmed',
].join(', ');

export interface CostCentre {
  code: string;
  name_en: string;
  name_ar: string;
}

export interface ItemCode {
  code: number;
  name_en: string;
  name_ar: string;
  scope: 'site' | 'office';
}

export interface LineDraft {
  key: string;
  line_date: string;
  project_id: string;
  account_id: string;
  category: string;
  item_code: string;
  description: string;
  is_return: boolean;
  amount: string;
  rate: string;
  receipt_link: string;
  confirm_duplicate: boolean;
}

export interface LineCheck {
  line_no: number;
  error: string | null;
  is_duplicate: boolean;
  rate: string | null;
  base_amount: string | null;
}

export const CHECK_COLUMNS = 'line_no, error, is_duplicate, rate:rate::text, base_amount:base_amount::text';

export type LineField = 'line_date' | 'project_id' | 'account_id' | 'category' | 'item_code' | 'description' | 'amount' | 'rate' | 'receipt_link';

const FIELD_PREFIXES: [string, LineField][] = [
  ['Date:', 'line_date'],
  ['Project:', 'project_id'],
  ['Paying account:', 'account_id'],
  ['Category:', 'category'],
  ['Item code:', 'item_code'],
  ['Description:', 'description'],
  ['Receipt link:', 'receipt_link'],
  ['Exchange rate:', 'rate'],
  ['Amount:', 'amount'],
];

export function fieldOfError(message: string | null): LineField | null {
  if (!message) return null;
  return FIELD_PREFIXES.find(([prefix]) => message.startsWith(prefix))?.[1] ?? null;
}

export function newKey(): string {
  return crypto.randomUUID();
}

export function blankLine(date: string): LineDraft {
  return {
    key: newKey(),
    line_date: date,
    project_id: '',
    account_id: '',
    category: '',
    item_code: '',
    description: '',
    is_return: false,
    amount: '',
    rate: '',
    receipt_link: '',
    confirm_duplicate: false,
  };
}

export function draftFromLine(l: ExpenseLine): LineDraft {
  return {
    key: newKey(),
    line_date: l.line_date,
    project_id: l.project_id,
    account_id: l.account_id,
    category: l.category,
    item_code: String(l.item_code),
    description: l.description,
    is_return: l.is_return,
    amount: l.amount,
    rate: l.rate ?? '',
    receipt_link: l.receipt_link ?? '',
    confirm_duplicate: l.dup_confirmed,
  };
}

export function needsRate(line: LineDraft, accounts: Map<string, CashAccount>, base: Currency): boolean {
  const account = accounts.get(line.account_id);
  return !!account && account.currency !== base;
}

export function toPayload(lines: LineDraft[], accounts: Map<string, CashAccount>, base: Currency) {
  return lines.map((l) => {
    const code = l.item_code.trim();
    return {
      line_date: l.line_date || null,
      project_id: l.project_id || null,
      account_id: l.account_id || null,
      category: l.category || null,
      item_code: /^\d+$/.test(code) ? Number(code) : null,
      description: l.description,
      is_return: l.is_return,
      amount: normalizeAmount(l.amount) || null,
      rate: needsRate(l, accounts, base) ? normalizeAmount(l.rate) || null : null,
      receipt_link: l.receipt_link.trim() || null,
      confirm_duplicate: l.confirm_duplicate,
    };
  });
}

/** Per-currency sums of the typed amounts, returns subtracted. Lines whose amount is not a number are skipped. */
export function currencyTotals(lines: LineDraft[], accounts: Map<string, CashAccount>): { currency: Currency; total: string }[] {
  const totals = new Map<Currency, bigint>();
  for (const l of lines) {
    const currency = accounts.get(l.account_id)?.currency;
    const amount = normalizeAmount(l.amount);
    if (!currency || !amount) continue;
    const scale = currencyDecimals(currency);
    const units = toUnits(amount, scale);
    if (units === null) continue;
    totals.set(currency, (totals.get(currency) ?? BigInt(0)) + (l.is_return ? -units : units));
  }
  return [...totals].map(([currency, units]) => ({ currency, total: fromUnits(units, currencyDecimals(currency)) }));
}

/** Sum of the database's base amounts, returns subtracted; null while any line has no base amount yet. */
export function baseTotal(lines: LineDraft[], checks: (LineCheck | undefined)[]): string | null {
  const scale = 9;
  let total = BigInt(0);
  for (let i = 0; i < lines.length; i += 1) {
    const value = checks[i]?.base_amount;
    const units = value ? toUnits(value, scale) : null;
    if (units === null) return null;
    total += lines[i].is_return ? -units : units;
  }
  return fromUnits(total, scale);
}

/** Splits the database's "Line N: ..." message (one per text line) into per-line parts and the rest. */
export function splitLineErrors(message: string): { byLine: Map<number, string>; rest: string } {
  const byLine = new Map<number, string>();
  const rest: string[] = [];
  for (const part of message.split('\n')) {
    const match = /^Line (\d+): (.*)$/s.exec(part.trim());
    if (match) byLine.set(Number(match[1]), match[2]);
    else if (part.trim()) rest.push(part.trim());
  }
  return { byLine, rest: rest.join('\n') };
}
