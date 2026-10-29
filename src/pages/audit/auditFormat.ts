import { en, type TranslationKey } from '../../i18n/en';
import { formatAmount } from '../../lib/money';
import { CURRENCIES, type Currency } from '../../types';

export interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  company_id: string | null;
  company_code: string | null;
  company_name: string | null;
  scope: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: { new?: Record<string, unknown>; old?: Record<string, unknown> } | null;
}

export const AUDIT_ACTIONS = ['insert', 'update', 'delete', 'password_reset'] as const;

export const AUDIT_ENTITIES = [
  'companies',
  'company_users',
  'staff_members',
  'staff_hr_details',
  'staff_assignments',
  'support_sessions',
  'user',
  'item_codes',
  'fee_table',
  'entries',
  'period_closes',
  'clients',
  'projects',
  'project_milestones',
  'cash_accounts',
  'client_payments',
  'project_completion',
  'fee_charges',
] as const;

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

function isKey(key: string): key is TranslationKey {
  return key in en;
}

const IGNORED = new Set(['updated_at']);

const MONEY_PAIRS: Record<string, string> = {
  monthly_service_fee: 'service_fee_currency',
  basic_salary: 'salary_currency',
};

const ENUM_PREFIX: Record<string, string> = {
  role: 'role',
  staff_role: 'role',
  status: 'status',
  service_model: 'model',
  mode: 'support.mode',
  salary_frequency: 'pay.freq',
};

export function actionLabel(action: string, t: T): string {
  const key = `audit.action.${action}`;
  return isKey(key) ? t(key) : action;
}

export function entityLabel(entity: string, t: T): string {
  const key = `audit.entity.${entity}`;
  return isKey(key) ? t(key) : entity;
}

export function fieldLabel(field: string, t: T): string {
  const key = `field.${field}`;
  return isKey(key) ? t(key) : field;
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

export function formatValue(field: string, value: unknown, record: Record<string, unknown> | undefined, t: T): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t('audit.yes') : t('audit.no');
  const currencyField = MONEY_PAIRS[field];
  if (currencyField && record && isCurrency(record[currencyField])) {
    return formatAmount(String(value), record[currencyField]);
  }
  const prefix = ENUM_PREFIX[field];
  if (prefix && typeof value === 'string') {
    const key = `${prefix}.${value}`;
    if (isKey(key)) return t(key);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export interface Change {
  field: string;
  before: unknown;
  after: unknown;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function changesOf(entry: AuditEntry): Change[] {
  const before = entry.details?.old ?? {};
  const after = entry.details?.new ?? {};
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((f) => !IGNORED.has(f));
  const changes = fields.map((field) => ({ field, before: before[field], after: after[field] }));
  if (entry.details?.old && entry.details?.new) return changes.filter((c) => !same(c.before, c.after));
  return changes.filter((c) => c.before !== null || c.after !== null);
}

export function recordName(entry: AuditEntry): string | null {
  const rec = entry.details?.new ?? entry.details?.old;
  if (!rec) return null;
  for (const key of ['full_name', 'name', 'code', 'email']) {
    const v = rec[key];
    if (typeof v === 'string' && v) return v;
  }
  return null;
}
