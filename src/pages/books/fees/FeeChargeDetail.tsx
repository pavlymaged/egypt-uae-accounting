import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, Card } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { trimZeros } from '../../../lib/decimal';
import { formatDate } from '../../../lib/dates';
import { formatNumber } from '../../../lib/money';
import type { BooksAccess, CashAccount } from '../books';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryJournalSection, EntryTimeline, useEntryTrail } from '../entries/EntryTrail';
import type { FeeCharge } from './feeCharges';
import { FeeModeText } from './FeeModeText';

interface Props {
  charge: FeeCharge;
  access: BooksAccess;
  accounts: CashAccount[];
  onBack: () => void;
  onEdit: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

export function FeeChargeDetail({ charge: c, access, accounts, onBack, onEdit, onDone, onError }: Props) {
  const { t, lang } = useI18n();
  const trail = useEntryTrail(c, access.companyId);
  const money = (value: string, currency = c.currency) => <span dir="ltr" className="tabular-nums">{`${formatNumber(value, currency)} ${currency}`}</span>;
  const otherCurrency = c.currency !== access.currency;

  return (
    <div className="animate-fade-in space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('feeCharges.backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <EntryStatusBadge status={c.status} />
            <span className="text-sm text-ink-500">{formatDate(c.entry_date, lang)}</span>
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">{money(c.amount)}</h2>
          <p className="text-sm text-ink-600">
            <span dir="ltr" className="me-2 font-mono text-xs text-brand-700">{c.project_code}</span>
            {c.project_name}
            <span className="mx-2 text-ink-300">·</span>
            {t('feeCharges.atPercent', { percent: trimZeros(c.milestone_percent) })}
          </p>
        </div>
        <EntryActions entry={c} kind="feeCharge" onEdit={onEdit} onDone={onDone} onError={onError} />
      </div>

      {c.status === 'rejected' && c.reject_comment && <Alert tone="warning">{t('feeCharges.returnedWith', { comment: c.reject_comment })}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('feeCharges.details')}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label={t('payments.field.project')}>{`${c.project_code} - ${c.project_name}`}</Item>
            <Item label={t('payments.field.client')}>{c.client_name ?? '-'}</Item>
            <Item label={t('payments.field.date')}>{formatDate(c.entry_date, lang)}</Item>
            <Item label={t('feeCharges.field.instalment')}><span dir="ltr">{`${trimZeros(c.milestone_percent)}%`}</span></Item>
            <Item label={t('payments.field.amount')}>{money(c.amount)}</Item>
            <Item label={t('feeCharges.field.mode')}><FeeModeText charge={c} /></Item>
            {otherCurrency && <Item label={t('payments.field.rate')}><span dir="ltr">{`1 ${c.currency} = ${trimZeros(c.rate)} ${access.currency}`}</span></Item>}
            {otherCurrency && <Item label={t('payments.preview.base', { currency: access.currency })}>{money(c.base_amount, access.currency)}</Item>}
            <div className="sm:col-span-2">
              <Item label={t('payments.field.notes')}><span className="whitespace-pre-line">{c.notes || '-'}</span></Item>
            </div>
          </dl>
        </Card>
        <EntryTimeline entry={c} trail={trail} />
      </div>

      <EntryJournalSection trail={trail} access={access} accounts={accounts} />
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd dir="auto" className="text-sm text-ink-900">{children}</dd>
    </div>
  );
}
