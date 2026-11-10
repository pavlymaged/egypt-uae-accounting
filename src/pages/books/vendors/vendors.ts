import type { Currency } from '../../../types';
import type { ItemCode } from '../expenses/expenses';

export interface QuotationTotal {
  currency: Currency;
  client_total: string;
  office_total: string;
  commission: string;
}

export interface Engagement {
  engagement_id: string;
  vendor_id: string;
  vendor_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  vendor_active: boolean;
  is_active: boolean;
  project_id: string;
  project_code: string;
  project_name: string;
  profession: number;
  profession_name: string | null;
  profession_name_ar: string | null;
  serial: number;
  vendor_code: string;
  confirmed_different: boolean;
  created_at: string;
  quotation_count: number;
  quotation_totals: string | null;
}

export const ENGAGEMENT_COLUMNS = [
  'engagement_id, vendor_id, vendor_name, phone, email, notes, vendor_active, is_active',
  'project_id, project_code, project_name, profession, profession_name, profession_name_ar, serial, vendor_code',
  'confirmed_different, created_at, quotation_count, quotation_totals:quotation_totals::text',
].join(', ');

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
}

export const VENDOR_COLUMNS = 'id, name, phone, email, notes, is_active';

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
  is_operation: boolean;
  is_active: boolean;
}

export type Profession = ItemCode;

// JSON numbers would lose exact digits in JavaScript, so the amounts are quoted before parsing.
export function parseTotals(text: string | null): QuotationTotal[] {
  if (!text) return [];
  try {
    const quoted = text.replace(/("(?:client_total|office_total|commission)"\s*:\s*)(-?\d+(?:\.\d+)?)/g, '$1"$2"');
    const value: unknown = JSON.parse(quoted);
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is QuotationTotal => !!v && typeof v === 'object' && typeof (v as QuotationTotal).currency === 'string');
  } catch {
    return [];
  }
}
