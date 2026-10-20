export const STAFF_ROLES = ['super_admin', 'accounting_manager', 'checker', 'accountant'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const COMPANY_ROLES = ['owner', 'bookkeeper', 'site_engineer'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const CURRENCIES = ['EGP', 'USD', 'AED', 'SAR', 'BHD', 'OMR', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const SERVICE_MODELS = ['managed', 'self_service'] as const;
export type ServiceModel = (typeof SERVICE_MODELS)[number];

export const COMPANY_STATUSES = ['active', 'suspended', 'closed'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const SALARY_FREQUENCIES = ['year', 'month', 'week', 'on_request'] as const;
export type SalaryFrequency = (typeof SALARY_FREQUENCIES)[number];

export interface StaffMember {
  user_id: string;
  full_name: string;
  email: string;
  staff_role: StaffRole;
  position_title: string | null;
  joining_date: string | null;
  is_active: boolean;
}

export interface StaffHrDetails {
  user_id: string;
  date_of_birth: string | null;
  basic_salary: string | null;
  salary_currency: Currency | null;
  salary_frequency: SalaryFrequency | null;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  service_model: ServiceModel;
  status: CompanyStatus;
  base_currency: Currency;
  monthly_service_fee: string;
  service_fee_currency: Currency;
  owner_name: string | null;
  owner_email: string | null;
}

export interface CompanyMembership {
  company_id: string;
  role: CompanyRole;
  full_name: string;
  company: Pick<Company, 'id' | 'code' | 'name' | 'status'>;
}

export const PERMISSIONS = [
  'can_record',
  'can_post',
  'can_manage_vendors',
  'can_edit_quotations',
  'can_review_claims',
  'can_view_reports',
  'can_view_cash',
  'can_export',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface CompanyUser extends Record<Permission, boolean> {
  company_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: CompanyRole;
  is_active: boolean;
}

export const COMPANY_USER_COLUMNS = `company_id, user_id, full_name, email, role, is_active, ${PERMISSIONS.join(', ')}`;

export interface SupportSession {
  id: string;
  staff_user_id: string;
  company_id: string;
  reason: string;
  mode: 'read' | 'edit';
  edit_reason: string | null;
  opened_at: string;
  expires_at: string;
  closed_at: string | null;
}

export const SUPPORT_COLUMNS = 'id, staff_user_id, company_id, reason, mode, edit_reason, opened_at, expires_at, closed_at';

export function isSessionOpen(s: Pick<SupportSession, 'closed_at' | 'expires_at'>, now = Date.now()): boolean {
  return !s.closed_at && new Date(s.expires_at).getTime() > now;
}

export const COMPANY_COLUMNS =
  'id, code, name, service_model, status, base_currency, monthly_service_fee::text, service_fee_currency, owner_name, owner_email';

export const STAFF_COLUMNS = 'user_id, full_name, email, staff_role, position_title, joining_date, is_active';

export function isPlatformAdmin(role: StaffRole): boolean {
  return role === 'super_admin' || role === 'accounting_manager';
}
