import type { TranslationKey } from '../../../i18n/en';
import { formatNumber } from '../../../lib/money';
import type { Currency } from '../../../types';
import type { CashAccount, CashKind } from '../books';
import { WORKFLOW_COLUMNS, type EntryWorkflow } from '../entries/entries';

export const TRANSFER_TYPES = ['internal', 'custody_advance', 'reimbursement', 'custody_return'] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];

export const TYPE_LABEL: Record<TransferType, TranslationKey> = {
  internal: 'transfers.type.internal',
  custody_advance: 'transfers.type.custody_advance',
  reimbursement: 'transfers.type.reimbursement',
  custody_return: 'transfers.type.custody_return',
};

export const TYPE_HINT: Record<TransferType, TranslationKey> = {
  internal: 'transfers.typeHint.internal',
  custody_advance: 'transfers.typeHint.custody_advance',
  reimbursement: 'transfers.typeHint.reimbursement',
  custody_return: 'transfers.typeHint.custody_return',
};

export const isTransferType = (v: string): v is TransferType => (TRANSFER_TYPES as readonly string[]).includes(v);

export interface Transfer extends EntryWorkflow {
  transfer_type: string;
  from_account_id: string;
  from_code: string;
  from_name: string;
  from_kind: CashKind;
  to_account_id: string;
  to_code: string;
  to_name: string;
  to_kind: CashKind;
  currency_out: Currency;
  amount_out: string;
  rate_out: string;
  base_out: string;
  currency_in: Currency;
  amount_in: string;
  rate_in: string;
  base_in: string;
  fx_difference: string;
  confirm_overdraw: boolean;
  confirm_over_owed: boolean;
  notes: string | null;
  receipt_link: string | null;
}

export const TRANSFER_COLUMNS = [
  WORKFLOW_COLUMNS,
  'transfer_type, from_account_id, from_code, from_name, from_kind, to_account_id, to_code, to_name, to_kind',
  'currency_out, amount_out:amount_out::text, rate_out:rate_out::text, base_out:base_out::text',
  'currency_in, amount_in:amount_in::text, rate_in:rate_in::text, base_in:base_in::text, fx_difference:fx_difference::text',
  'confirm_overdraw, confirm_over_owed, notes, receipt_link',
].join(', ');

export interface BalanceAccount {
  account_id: string;
  code: string;
  name: string;
  kind: CashKind;
  currency: Currency;
  is_active: boolean;
  is_system: boolean;
  engineer_user_id: string | null;
  balance: string | null;
}

export const BALANCE_COLUMNS = 'account_id, code, name, kind, currency, is_active, is_system, engineer_user_id, balance:balance::text';

export const asCashAccount = (a: BalanceAccount): CashAccount => ({
  id: a.account_id,
  code: a.code,
  name: a.name,
  kind: a.kind,
  currency: a.currency,
  is_system: a.is_system,
  is_active: a.is_active,
});

export interface TransferPreviewRow {
  error: string | null;
  currency_out: Currency | null;
  currency_in: Currency | null;
  amount_out: string | null;
  rate_out: string | null;
  base_out: string | null;
  amount_in: string | null;
  rate_in: string | null;
  base_in: string | null;
  fx_difference: string | null;
  source_balance: string | null;
  owed: string | null;
  needs_overdraw_confirmation: boolean;
  needs_over_owed_confirmation: boolean;
}

export const PREVIEW_COLUMNS = [
  'error, currency_out, currency_in',
  'amount_out:amount_out::text, rate_out:rate_out::text, base_out:base_out::text',
  'amount_in:amount_in::text, rate_in:rate_in::text, base_in:base_in::text, fx_difference:fx_difference::text',
  'source_balance:source_balance::text, owed:owed::text, needs_overdraw_confirmation, needs_over_owed_confirmation',
].join(', ');

// Which side of a transfer may use custody accounts, per kind.
export function sideAllows(type: TransferType | '', side: 'from' | 'to', kind: CashKind): boolean {
  if (!type) return false;
  const custody = kind === 'custody';
  if (type === 'internal') return !custody;
  if (type === 'custody_return') return side === 'from' ? custody : !custody;
  return side === 'from' ? !custody : custody;
}

export const money = (value: string | null | undefined, currency: Currency) => `${formatNumber(value ?? '0', currency)} ${currency}`;

export const isNegativeText = (v: string | null | undefined) => String(v ?? '').trim().startsWith('-');
export const absText = (v: string | null | undefined) => String(v ?? '0').trim().replace(/^-/, '');
