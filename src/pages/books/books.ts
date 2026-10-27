import type { TranslationKey } from '../../i18n/en';
import { isNetworkError } from '../../lib/errors';
import { isPlatformAdmin, isSessionOpen, type Company, type CompanyRole, type Currency, type StaffRole, type SupportSession } from '../../types';

export interface BooksAccess {
  companyId: string;
  canManageSetup: boolean;
  canManageClients: boolean;
  currency: Currency;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
}

export const CLIENT_COLUMNS = 'id, name, phone, email, notes, is_active';

export type FeeMethod = 'percent' | 'fixed' | 'none';

export interface Project {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  project_type: string | null;
  is_operation: boolean;
  is_active: boolean;
  fee_method: FeeMethod;
  fee_markup: string | null;
  fixed_fee_total: string | null;
  fixed_fee_currency: Currency | null;
  notes: string | null;
  version: number;
  updated_at: string | null;
}

export const PROJECT_COLUMNS =
  'id, code, name, client_id, project_type, is_operation, is_active, fee_method, fee_markup:fee_markup::text, fixed_fee_total:fixed_fee_total::text, fixed_fee_currency, notes, version, updated_at';

export interface Milestone {
  project_id: string;
  completion_percent: string;
  amount: string;
  sort_order: number;
}

export const MILESTONE_COLUMNS = 'project_id, completion_percent:completion_percent::text, amount:amount::text, sort_order';

export interface FeeRate {
  markup: string;
  on_income: string;
}

export interface ProjectType {
  code: string;
  name_en: string;
}

export const CASH_KINDS = ['bank', 'main_cash', 'emergency_bank', 'extra', 'custody'] as const;
export type CashKind = (typeof CASH_KINDS)[number];

export interface CashAccount {
  id: string;
  code: string;
  name: string;
  kind: CashKind;
  currency: Currency;
  is_system: boolean;
  is_active: boolean;
}

export const CASH_COLUMNS = 'id, code, name, kind, currency, is_system, is_active';

type CompanyRef = Pick<Company, 'id' | 'service_model' | 'status' | 'base_currency'>;

// Mirrors the database's own rules only to hide buttons that would certainly be refused; the database still decides.
export function staffBooksAccess(role: StaffRole, company: CompanyRef, support: SupportSession | null): BooksAccess | null {
  const open = company.status === 'active';
  if (company.service_model === 'self_service') {
    if (!isPlatformAdmin(role) || !support || support.company_id !== company.id || !isSessionOpen(support)) return null;
    const edit = open && support.mode === 'edit';
    return { companyId: company.id, canManageSetup: edit, canManageClients: edit, currency: company.base_currency };
  }
  const setup = open && isPlatformAdmin(role);
  return { companyId: company.id, canManageSetup: setup, canManageClients: setup || (open && role === 'accountant'), currency: company.base_currency };
}

export function memberBooksAccess(role: CompanyRole, canRecord: boolean, company: CompanyRef): BooksAccess {
  const open = company.status === 'active' && company.service_model === 'self_service';
  const owner = open && role === 'owner';
  return {
    companyId: company.id,
    canManageSetup: owner,
    canManageClients: owner || (open && role === 'bookkeeper' && canRecord),
    currency: company.base_currency,
  };
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function dbErrorText(error: { message?: string } | null, t: Translate): string {
  if (!error) return t('common.unexpected');
  if (isNetworkError(error)) return t('common.networkError');
  const message = (error.message ?? '').trim();
  if (!message) return t('common.unexpected');
  if (/^not found\.?$/i.test(message)) return t('books.notFound');
  return message;
}

export function fieldFromMessage<F extends string>(message: string, prefixes: [string, F][]): F | null {
  const hit = prefixes.find(([prefix]) => message.startsWith(prefix));
  return hit ? hit[1] : null;
}
