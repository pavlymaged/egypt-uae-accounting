import { Badge } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { isNegativeText, money } from '../transfers/transfers';
import type { Currency } from '../../../types';
import { isQuotationState, isRevisionStatus, REVISION_LABEL, REVISION_TONE, STATE_LABEL, STATE_TONE, type Quotation } from './quotations';

interface TotalsProps {
  currency: Currency;
  client: string | null;
  office: string | null;
  commission: string | null;
  compact?: boolean;
}

export function TotalsTriple({ currency, client, office, commission, compact = false }: TotalsProps) {
  const { t } = useI18n();
  const cell = (label: string, value: string | null, tone = 'text-ink-900') => (
    <div className={compact ? 'min-w-0' : 'min-w-0 rounded-lg bg-ink-50 px-3 py-2'}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p dir="ltr" className={`truncate font-semibold tabular-nums rtl:text-end ${compact ? 'text-sm' : 'text-base'} ${tone}`}>{value === null ? '-' : money(value, currency)}</p>
    </div>
  );
  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-3' : 'gap-2'}`}>
      {cell(t('quotations.clientTotal'), client)}
      {cell(t('quotations.officeTotal'), office)}
      {cell(t('quotations.commission'), commission, isNegativeText(commission) ? 'text-red-700' : 'text-emerald-700')}
    </div>
  );
}

export function QuotationStateBadges({ quotation }: { quotation: Quotation }) {
  const { t } = useI18n();
  const state = quotation.state;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge tone={isQuotationState(state) ? STATE_TONE[state] : 'neutral'}>{isQuotationState(state) ? t(STATE_LABEL[state]) : state}</Badge>
      {state === 'approved' && quotation.has_open_revision && (
        <Badge tone="warning">{t('quotations.revisionWaiting', { n: quotation.latest_revision })}</Badge>
      )}
    </span>
  );
}

export function RevisionStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <Badge tone={isRevisionStatus(status) ? REVISION_TONE[status] : 'neutral'}>{isRevisionStatus(status) ? t(REVISION_LABEL[status]) : status}</Badge>;
}
