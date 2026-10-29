import type { TranslationKey } from '../../../i18n/en';
import { fromUnits, toUnits } from '../../../lib/decimal';
import type { Currency } from '../../../types';

export const ENTRY_STATUSES = ['draft', 'submitted', 'rejected', 'posted', 'reversed'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export interface EntryWorkflow {
  entry_id: string;
  company_id: string;
  status: EntryStatus;
  entry_date: string;
  created_by: string | null;
  created_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  rejected_at: string | null;
  reject_comment: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  journal_id: string | null;
  can_edit: boolean;
  can_submit: boolean;
  can_post: boolean;
  can_reject: boolean;
  can_reverse: boolean;
  can_discard: boolean;
}

export const WORKFLOW_COLUMNS = [
  'entry_id, company_id, status, entry_date, created_by, created_at, submitted_by, submitted_at, rejected_at, reject_comment',
  'posted_by, posted_at, reversed_at, reversal_reason, journal_id',
  'can_edit, can_submit, can_post, can_reject, can_reverse, can_discard',
].join(', ');

export const STATUS_LABEL: Record<EntryStatus, TranslationKey> = {
  draft: 'payments.status.draft',
  submitted: 'payments.status.submitted',
  rejected: 'payments.status.rejected',
  posted: 'payments.status.posted',
  reversed: 'payments.status.reversed',
};

export interface JournalLine {
  journal_id: string;
  journal_date: string;
  is_reversal: boolean;
  line_no: number;
  account_key: string;
  side: 'debit' | 'credit';
  currency: Currency;
  amount: string;
  rate: string;
  base_amount: string;
  memo: string | null;
}

export const JOURNAL_COLUMNS =
  'journal_id, journal_date, is_reversal, line_no, account_key, side, currency, amount:amount::text, rate:rate::text, base_amount:base_amount::text, memo';

// Wide enough for every stored amount, rate and percentage, so the arithmetic is always exact.
const SCALE = 9;

export function subtractText(a: string, b: string): string | null {
  const x = toUnits(a, SCALE);
  const y = toUnits(b, SCALE);
  if (x === null || y === null) return null;
  return fromUnits(x - y, SCALE);
}

export function sumText(values: string[]): string | null {
  let total = BigInt(0);
  for (const v of values) {
    const units = toUnits(v, SCALE);
    if (units === null) return null;
    total += units;
  }
  return fromUnits(total, SCALE);
}

/** -1, 0 or 1 like a comparator; null when either value is not a number. */
export function compareText(a: string, b: string): number | null {
  const x = toUnits(a, SCALE);
  const y = toUnits(b, SCALE);
  if (x === null || y === null) return null;
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isZeroText(value: string | null | undefined): boolean {
  const units = value ? toUnits(value, SCALE) : null;
  return units === null || units === BigInt(0);
}
