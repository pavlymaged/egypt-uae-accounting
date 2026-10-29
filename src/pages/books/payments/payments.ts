import type { Currency } from '../../../types';
import { WORKFLOW_COLUMNS, type EntryWorkflow } from '../entries/entries';

export interface Payment extends EntryWorkflow {
  project_id: string;
  project_code: string;
  project_name: string;
  client_name: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  amount: string;
  currency: Currency;
  rate: string;
  base_amount: string;
  fee_rate: string;
  fee_amount: string;
  fee_base_amount: string;
  received_by: string | null;
  notes: string | null;
  receipt_link: string | null;
}

export const PAYMENT_COLUMNS = [
  WORKFLOW_COLUMNS,
  'project_id, project_code, project_name, client_name',
  'account_id, account_code, account_name, amount:amount::text, currency, rate:rate::text, base_amount:base_amount::text',
  'fee_rate:fee_rate::text, fee_amount:fee_amount::text, fee_base_amount:fee_base_amount::text, received_by, notes, receipt_link',
].join(', ');

export interface Preview {
  rate: string;
  base_amount: string;
  fee_rate: string;
  fee_amount: string;
  fee_base_amount: string;
}

export const PREVIEW_COLUMNS =
  'rate:rate::text, base_amount:base_amount::text, fee_rate:fee_rate::text, fee_amount:fee_amount::text, fee_base_amount:fee_base_amount::text';
