import type { TranslationKey } from '../../i18n/en';
import type { Currency } from '../../types';

export const CLAIM_STATES = ['submitted', 'pre_approved', 'approved', 'rejected', 'reversed', 'cancelled'] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

export interface SiteClaim {
  claim_id: string;
  company_id: string;
  engineer_user_id: string;
  engineer_name: string | null;
  project_id: string;
  project_code: string | null;
  project_name: string | null;
  claim_date: string;
  amount: string;
  category: string;
  category_name: string | null;
  item_code: number | string | null;
  item_name: string | null;
  item_name_ar: string | null;
  description: string | null;
  receipt_link: string | null;
  state: ClaimState;
  reject_comment: string | null;
  rejected_at: string | null;
  pre_approved_at: string | null;
  approved_at: string | null;
  created_at: string;
  entry_id: string | null;
  can_edit: boolean;
  can_cancel: boolean;
  can_preapprove: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_reverse: boolean;
}

export const CLAIM_COLUMNS =
  'claim_id, company_id, engineer_user_id, engineer_name, project_id, project_code, project_name, claim_date, amount:amount::text, category, category_name, item_code, item_name, item_name_ar, description, receipt_link, state, reject_comment, rejected_at, pre_approved_at, approved_at, created_at, entry_id, can_edit, can_cancel, can_preapprove, can_approve, can_reject, can_reverse';

export const STATE_LABEL: Record<ClaimState, TranslationKey> = {
  submitted: 'claims.state.submitted',
  pre_approved: 'claims.state.pre_approved',
  approved: 'claims.state.approved',
  rejected: 'claims.state.rejected',
  reversed: 'claims.state.reversed',
  cancelled: 'claims.state.cancelled',
};

export const STATE_TONE: Record<ClaimState, 'sky' | 'gold' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  submitted: 'sky',
  pre_approved: 'gold',
  approved: 'success',
  rejected: 'warning',
  reversed: 'danger',
  cancelled: 'neutral',
};

export interface MyProject {
  company_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
}

export interface Custody {
  company_id: string;
  account_id: string;
  account_name: string;
  currency: Currency;
  balance: string;
}

export const CUSTODY_COLUMNS = 'company_id, account_id, account_name, currency, balance:balance::text';

export interface EngineerProjectRef {
  project_id: string;
  code: string;
  name: string;
}

export interface EngineerOverview {
  company_id: string;
  engineer_user_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  account_id: string | null;
  account_name: string | null;
  currency: Currency | null;
  custody_balance: string | null;
  projects: EngineerProjectRef[] | null;
}

export const ENGINEER_COLUMNS =
  'company_id, engineer_user_id, full_name, email, is_active, account_id, account_name, currency, custody_balance:custody_balance::text, projects';

export type BalanceSide = 'owed' | 'holding' | 'even';

export function balanceSide(balance: string | null | undefined): { side: BalanceSide; magnitude: string } {
  const value = String(balance ?? '').trim();
  if (!value || /^-?0*(\.0*)?$/.test(value)) return { side: 'even', magnitude: '0' };
  if (value.startsWith('-')) return { side: 'owed', magnitude: value.slice(1) };
  return { side: 'holding', magnitude: value.replace(/^\+/, '') };
}

export function claimItemLabel(c: Pick<SiteClaim, 'item_code' | 'item_name' | 'item_name_ar'>, lang: string): string {
  const name = (lang === 'ar' && c.item_name_ar) || c.item_name || '';
  const code = c.item_code === null || c.item_code === undefined ? '' : String(c.item_code);
  return [code, name].filter(Boolean).join(' · ');
}

export function isSafeLink(link: string | null | undefined): link is string {
  return typeof link === 'string' && /^https?:\/\//i.test(link.trim());
}
