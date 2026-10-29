import { fromUnits, toUnits } from '../../../lib/decimal';
import type { Currency } from '../../../types';
import { WORKFLOW_COLUMNS, type EntryWorkflow } from '../entries/entries';

export type FeeMode = 'deducted' | 'direct';

export interface FeeCharge extends EntryWorkflow {
  project_id: string;
  project_code: string;
  project_name: string;
  client_name: string | null;
  milestone_percent: string;
  amount: string;
  currency: Currency;
  rate: string;
  base_amount: string;
  mode: FeeMode;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  notes: string | null;
}

export const FEE_CHARGE_COLUMNS = [
  WORKFLOW_COLUMNS,
  'project_id, project_code, project_name, client_name, milestone_percent:milestone_percent::text',
  'amount:amount::text, currency, rate:rate::text, base_amount:base_amount::text, mode, account_id, account_code, account_name, notes',
].join(', ');

export type MilestoneState = 'not_reached' | 'chargeable' | 'pending' | 'charged';

export interface FeeMilestone {
  project_id: string;
  fee_currency: Currency;
  completion_percent: string;
  amount: string;
  sort_order: number;
  current_completion: string | null;
  reached: boolean;
  charge_entry_id: string | null;
  charge_status: string | null;
  state: MilestoneState;
}

export const FEE_MILESTONE_COLUMNS =
  'project_id, fee_currency, completion_percent:completion_percent::text, amount:amount::text, sort_order, current_completion:current_completion::text, reached, charge_entry_id, charge_status, state';

export interface FeeSummary {
  fee_currency: Currency;
  total_fee: string;
  current_completion: string | null;
  charged_amount: string;
  pending_amount: string;
  remaining_amount: string;
}

export const FEE_SUMMARY_COLUMNS =
  'fee_currency, total_fee:total_fee::text, current_completion:current_completion::text, charged_amount:charged_amount::text, pending_amount:pending_amount::text, remaining_amount:remaining_amount::text';

export interface FundsLine {
  currency: Currency;
  funds_held: string;
}

export const FUNDS_COLUMNS = 'currency, funds_held:funds_held::text';

/** A stored percentage as a CSS width, clamped to 0-100, without floating point. */
export function percentWidth(percent: string | null | undefined): string {
  const units = percent ? toUnits(percent, 2) : null;
  if (units === null || units <= BigInt(0)) return '0%';
  const max = BigInt(10000);
  return `${fromUnits(units > max ? max : units, 2)}%`;
}
