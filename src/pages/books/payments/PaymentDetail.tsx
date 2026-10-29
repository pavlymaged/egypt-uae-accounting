import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, Card } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { trimZeros } from '../../../lib/decimal';
import { formatDate } from '../../../lib/dates';
import { formatNumber } from '../../../lib/money';
import { ratePercent } from '../../../lib/rates';
import type { BooksAccess, CashAccount } from '../books';
import { isZeroText, subtractText } from '../entries/entries';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryJournalSection, EntryTimeline, useEntryTrail } from '../entries/EntryTrail';
import type { Payment } from './payments';

interface Props {
  payment: Payment;
  access: BooksAccess;
  accounts: CashAccount[];
  onBack: () => void;
  onEdit: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

export function PaymentDetail({ payment: p, access, accounts, onBack, onEdit, onDone, onError }: Props) {
  const { t, lang } = useI18n();
  const trail = useEntryTrail(p, access.companyId);
  const money = (value: string, currency = p.currency) => <span dir="ltr" className="tabular-nums">{`${formatNumber(value, currency)} ${currency}`}</span>;
  const otherCurrency = p.currency !== access.currency;
  const net = subtractText(p.amount, p.fee_amount);
  const safeLink = p.receipt_link && /^https?:\/\//i.test(p.receipt_link) ? p.receipt_link : null;

  return (
    <div className="animate-fade-in space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('payments.backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <EntryStatusBadge status={p.status} />
            <span className="text-sm text-ink-500">{formatDate(p.entry_date, lang)}</span>
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">{money(p.amount)}</h2>
          <p className="text-sm text-ink-600">
            <span dir="ltr" className="me-2 font-mono text-xs text-brand-700">{p.project_code}</span>
            {p.project_name}
          </p>
        </div>
        <EntryActions entry={p} kind="payment" onEdit={onEdit} onDone={onDone} onError={onError} />
      </div>

      {p.status === 'rejected' && p.reject_comment && <Alert tone="warning">{t('payments.returnedWith', { comment: p.reject_comment })}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('payments.details')}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label={t('payments.field.project')}>{`${p.project_code} - ${p.project_name}`}</Item>
            <Item label={t('payments.field.client')}>{p.client_name ?? '-'}</Item>
            <Item label={t('payments.field.date')}>{formatDate(p.entry_date, lang)}</Item>
            <Item label={t('payments.field.account')}>{`${p.account_name} (${p.currency})`}</Item>
            <Item label={t('payments.field.amount')}>{money(p.amount)}</Item>
            {otherCurrency && <Item label={t('payments.field.rate')}><span dir="ltr">{`1 ${p.currency} = ${trimZeros(p.rate)} ${access.currency}`}</span></Item>}
            {otherCurrency && <Item label={t('payments.preview.base', { currency: access.currency })}>{money(p.base_amount, access.currency)}</Item>}
            {isZeroText(p.fee_amount) ? (
              <Item label={t('payments.col.fee')}>{t('payments.noFeeShort')}</Item>
            ) : (
              <>
                <Item label={t('payments.preview.feeRate')}>{t('payments.preview.feeRateValue', { rate: ratePercent(p.fee_rate) })}</Item>
                <Item label={t('payments.preview.fee')}>{money(p.fee_amount)}</Item>
                {net !== null && <Item label={t('payments.preview.net')}>{money(net)}</Item>}
              </>
            )}
            <Item label={t('payments.field.receivedBy')}>{p.received_by || '-'}</Item>
            <Item label={t('payments.field.link')}>
              {safeLink ? (
                <a href={safeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                  {t('payments.openReceipt')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                p.receipt_link || '-'
              )}
            </Item>
            <div className="sm:col-span-2">
              <Item label={t('payments.field.notes')}><span className="whitespace-pre-line">{p.notes || '-'}</span></Item>
            </div>
          </dl>
        </Card>

        <EntryTimeline entry={p} trail={trail} />
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
