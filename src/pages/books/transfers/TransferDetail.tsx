import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, Badge, Card } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { trimZeros } from '../../../lib/decimal';
import { formatDate } from '../../../lib/dates';
import type { BooksAccess, CashAccount } from '../books';
import { isZeroText } from '../entries/entries';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryJournalSection, EntryTimeline, useEntryTrail } from '../entries/EntryTrail';
import { absText, isNegativeText, isTransferType, money, TYPE_LABEL, type Transfer } from './transfers';

interface Props {
  transfer: Transfer;
  access: BooksAccess;
  accounts: CashAccount[];
  onBack: () => void;
  onEdit: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

export function TransferDetail({ transfer: tr, access, accounts, onBack, onEdit, onDone, onError }: Props) {
  const { t, lang } = useI18n();
  const trail = useEntryTrail(tr, access.companyId);
  const amount = (value: string, currency = access.currency) => <span dir="ltr" className="tabular-nums">{money(value, currency)}</span>;
  const differs = tr.currency_out !== tr.currency_in;
  const safeLink = tr.receipt_link && /^https?:\/\//i.test(tr.receipt_link) ? tr.receipt_link : null;
  const typeLabel = isTransferType(tr.transfer_type) ? t(TYPE_LABEL[tr.transfer_type]) : tr.transfer_type;
  const rate = (r: string, currency: string) => <span dir="ltr">{`1 ${currency} = ${trimZeros(r)} ${access.currency}`}</span>;

  return (
    <div className="animate-fade-in space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('transfers.backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <EntryStatusBadge status={tr.status} />
            <Badge tone="brand">{typeLabel}</Badge>
            <span className="text-sm text-ink-500">{formatDate(tr.entry_date, lang)}</span>
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">{amount(tr.amount_out, tr.currency_out)}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
            <span dir="auto">{tr.from_name}</span>
            <ArrowRight className="h-4 w-4 text-ink-400 rtl:-scale-x-100" />
            <span dir="auto">{tr.to_name}</span>
          </p>
        </div>
        <EntryActions entry={tr} kind="transfer" onEdit={onEdit} onDone={onDone} onError={onError} />
      </div>

      {tr.status === 'rejected' && tr.reject_comment && <Alert tone="warning">{t('payments.returnedWith', { comment: tr.reject_comment })}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('payments.details')}</h3>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Item label={t('transfers.field.type')}>{typeLabel}</Item>
              <Item label={t('payments.field.date')}>{formatDate(tr.entry_date, lang)}</Item>
              <Item label={t('transfers.field.from')}>{`${tr.from_name} (${tr.currency_out})`}</Item>
              <Item label={t('transfers.field.to')}>{`${tr.to_name} (${tr.currency_in})`}</Item>
              <Item label={t('transfers.field.amountOut')}>{amount(tr.amount_out, tr.currency_out)}</Item>
              <Item label={t('transfers.field.amountIn')}>{amount(tr.amount_in, tr.currency_in)}</Item>
              {tr.currency_out !== access.currency && <Item label={t('transfers.field.rateOut')}>{rate(tr.rate_out, tr.currency_out)}</Item>}
              {differs && tr.currency_in !== access.currency && <Item label={t('transfers.field.rateIn')}>{rate(tr.rate_in, tr.currency_in)}</Item>}
              <Item label={t('transfers.baseOut', { currency: access.currency })}>{amount(tr.base_out)}</Item>
              <Item label={t('transfers.baseIn', { currency: access.currency })}>{amount(tr.base_in)}</Item>
              <Item label={t('transfers.fxTitle')}>
                {isZeroText(tr.fx_difference) ? t('transfers.fxNone') : t(isNegativeText(tr.fx_difference) ? 'transfers.fxLoss' : 'transfers.fxGain', { amount: money(absText(tr.fx_difference), access.currency) })}
              </Item>
              <Item label={t('payments.field.link')}>
                {safeLink ? (
                  <a href={safeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                    {t('payments.openReceipt')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  tr.receipt_link || '-'
                )}
              </Item>
              <div className="sm:col-span-2">
                <Item label={t('payments.field.notes')}><span className="whitespace-pre-line">{tr.notes || '-'}</span></Item>
              </div>
            </dl>
          </Card>

          <Card className="p-5 sm:p-6">
            <h3 className="mb-1 text-sm font-semibold text-ink-900">{t('transfers.confirmations')}</h3>
            <p className="mb-4 text-xs text-ink-500">{t('transfers.confirmationsHint')}</p>
            <ul className="space-y-2 text-sm">
              <ConfirmRow on={tr.confirm_overdraw} label={t('transfers.badge.overdraw')} />
              <ConfirmRow on={tr.confirm_over_owed} label={t('transfers.badge.overOwed')} />
            </ul>
          </Card>
        </div>

        <EntryTimeline entry={tr} trail={trail} />
      </div>

      <EntryJournalSection trail={trail} access={access} accounts={accounts} />
    </div>
  );
}

function ConfirmRow({ on, label }: { on: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-ink-700">{label}</span>
      <Badge tone={on ? 'warning' : 'neutral'}>{on ? t('transfers.confirmedYes') : t('transfers.confirmedNo')}</Badge>
    </li>
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
