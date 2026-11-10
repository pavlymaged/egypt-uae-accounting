import type { BadgeTone } from '../../../components/ui/Feedback';
import type { TranslationKey } from '../../../i18n/en';
import { fromUnits, sumUnits, toUnits, trimZeros } from '../../../lib/decimal';
import type { Currency } from '../../../types';

export const QUOTATION_STATES = ['draft', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
export type QuotationState = (typeof QUOTATION_STATES)[number];

export const STATE_LABEL: Record<QuotationState, TranslationKey> = {
  draft: 'quotations.state.draft',
  submitted: 'quotations.state.submitted',
  approved: 'quotations.state.approved',
  rejected: 'quotations.state.rejected',
  cancelled: 'quotations.state.cancelled',
};

export const STATE_TONE: Record<QuotationState, BadgeTone> = {
  draft: 'neutral',
  submitted: 'sky',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

export const REVISION_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'superseded'] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const REVISION_LABEL: Record<RevisionStatus, TranslationKey> = {
  draft: 'quotations.state.draft',
  submitted: 'quotations.state.submitted',
  approved: 'quotations.state.approved',
  rejected: 'quotations.state.rejected',
  superseded: 'quotations.state.superseded',
};

export const REVISION_TONE: Record<RevisionStatus, BadgeTone> = { ...STATE_TONE, superseded: 'neutral' };

export const isQuotationState = (v: string): v is QuotationState => (QUOTATION_STATES as readonly string[]).includes(v);
export const isRevisionStatus = (v: string): v is RevisionStatus => (REVISION_STATUSES as readonly string[]).includes(v);

export interface Quotation {
  quotation_id: string;
  engagement_id: string;
  vendor_code: string;
  vendor_name: string;
  project_id: string;
  project_code: string;
  project_name: string;
  seq: number;
  reference: string;
  quotation_date: string;
  currency: Currency;
  notes: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  latest_revision_id: string;
  latest_revision: number;
  latest_status: string;
  latest_comment: string | null;
  approved_revision_id: string | null;
  approved_revision: number | null;
  latest_line_count: number;
  latest_client_total: string | null;
  latest_office_total: string | null;
  approved_client_total: string | null;
  approved_office_total: string | null;
  approved_commission: string | null;
  state: string;
  has_open_revision: boolean;
  can_edit: boolean;
  can_submit: boolean;
  can_decide: boolean;
  can_new_revision: boolean;
  can_cancel: boolean;
}

export const QUOTATION_COLUMNS = [
  'quotation_id, engagement_id, vendor_code, vendor_name, project_id, project_code, project_name, seq, reference, quotation_date, currency, notes',
  'cancelled_at, cancel_reason, created_at, latest_revision_id, latest_revision, latest_status, latest_comment, approved_revision_id, approved_revision, latest_line_count',
  'latest_client_total:latest_client_total::text, latest_office_total:latest_office_total::text',
  'approved_client_total:approved_client_total::text, approved_office_total:approved_office_total::text, approved_commission:approved_commission::text',
  'state, has_open_revision, can_edit, can_submit, can_decide, can_new_revision, can_cancel',
].join(', ');

export interface QuotationLine {
  revision_id: string;
  line_no: number;
  description: string;
  link: string | null;
  qty: string;
  unit: string | null;
  office_unit: string;
  client_unit: string;
  office_total: string;
  client_total: string;
  commission: string;
  confirm_below_office: boolean;
}

export const LINE_COLUMNS = [
  'revision_id, line_no, description, link, qty:qty::text, unit, office_unit:office_unit::text, client_unit:client_unit::text',
  'office_total:office_total::text, client_total:client_total::text, commission:commission::text, confirm_below_office',
].join(', ');

export interface Revision {
  id: string;
  revision: number;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  created_at: string;
}

export const REVISION_COLUMNS = 'id, revision, status, submitted_at, decided_at, decision_comment, created_at';

const SUM_SCALE = 8;

export function sumText(values: (string | null | undefined)[]): string {
  const units = values.map((v) => toUnits(String(v ?? '0'), SUM_SCALE) ?? BigInt(0));
  return trimZeros(fromUnits(sumUnits(units), SUM_SCALE));
}

