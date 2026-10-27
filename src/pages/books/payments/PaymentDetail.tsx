import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { trimZeros } from '../../../lib/decimal';
import { formatDate, formatDateTime } from '../../../lib/dates';
import { formatNumber } from '../../../lib/money';
import { ratePercent } from '../../../lib/rates';
import { supabase } from '../../../lib/supabase';
import type { BooksAccess, CashAccount } from '../books';
import { PaymentActions, PaymentStatusBadge } from './PaymentActions';
import { PaymentJournal } from './PaymentJournal';
import { JOURNAL_COLUMNS, isZeroText, subtractText, type JournalLine, type Payment } from './payments';

interface Props {
  payment: Payment;
  access: BooksAccess;
  accounts: CashAccount[];
  onBack: () => void;
  onEdit: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

interface Loaded {
  lines: JournalLine[];
  names: Map<string, string>;
  rejectedBy: string | null;
  reversedBy: string | null;
}

export function PaymentDetail({ payment: p, access, accounts, onBack, onEdit, onDone, onError }: Props) {
  const { t, lang } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cashName = useMemo(() => new Map(accounts.map((a) => [a.code, a.name])), [accounts]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      const [journal, entry] = await Promise.all([
        supabase.from('entry_journal_lines').select(JOURNAL_COLUMNS).eq('entry_id', p.entry_id).order('is_reversal').order('line_no'),
        supabase.from('entries').select('rejected_by, reversed_by').eq('id', p.entry_id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (journal.error || !Array.isArray(journal.data)) return setFailed(true);
      const rejectedBy = (entry.data?.rejected_by as string | null) ?? null;
      const reversedBy = (entry.data?.reversed_by as string | null) ?? null;
      const ids = [...new Set([p.created_by, p.submitted_by, p.posted_by, rejectedBy, reversedBy].filter((id): id is string => !!id))];
      const names = new Map<string, string>();
      if (ids.length) {
        const [staff, members] = await Promise.all([
          supabase.from('staff_members').select('user_id, full_name').in('user_id', ids),
          supabase.from('company_users').select('user_id, full_name').eq('company_id', access.companyId).in('user_id', ids),
        ]);
        for (const r of [...(members.data ?? []), ...(staff.data ?? [])] as { user_id: string; full_name: string }[]) names.set(r.user_id, r.full_name);
      }
      if (cancelled) return;
      setLoaded({ lines: journal.data as unknown as JournalLine[], names, rejectedBy, reversedBy });
    })();
    return () => {
      cancelled = true;
    };
  }, [p.entry_id, p.status, p.created_by, p.submitted_by, p.posted_by, access.companyId, attempt]);

  const who = (id: string | null) => (id && loaded?.names.get(id)) || '-';
  const money = (value: string, currency = p.currency) => <span dir="ltr" className="tabular-nums">{`${formatNumber(value, currency)} ${currency}`}</span>;
  const otherCurrency = p.currency !== access.currency;
  const net = subtractText(p.amount, p.fee_amount);
  const safeLink = p.receipt_link && /^https?:\/\//i.test(p.receipt_link) ? p.receipt_link : null;

  const events: { key: string; label: string; at: string | null; by: string | null; note?: string | null; tone: string }[] = [
    { key: 'recorded', label: t('payments.timeline.recorded'), at: p.created_at, by: p.created_by, tone: 'bg-ink-400' },
  ];
  if (p.submitted_at) events.push({ key: 'submitted', label: t('payments.timeline.submitted'), at: p.submitted_at, by: p.submitted_by, tone: 'bg-sky-500' });
  if (p.rejected_at) events.push({ key: 'returned', label: t('payments.timeline.returned'), at: p.rejected_at, by: loaded?.rejectedBy ?? null, note: p.reject_comment, tone: 'bg-amber-500' });
  if (p.posted_at) events.push({ key: 'posted', label: t('payments.timeline.posted'), at: p.posted_at, by: p.posted_by, tone: 'bg-emerald-500' });
  if (p.reversed_at) events.push({ key: 'reversed', label: t('payments.timeline.reversed'), at: p.reversed_at, by: loaded?.reversedBy ?? null, note: p.reversal_reason, tone: 'bg-red-500' });

  return (
    <div className="animate-fade-in space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('payments.backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={p.status} />
            <span className="text-sm text-ink-500">{formatDate(p.entry_date, lang)}</span>
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">{money(p.amount)}</h2>
          <p className="text-sm text-ink-600">
            <span dir="ltr" className="me-2 font-mono text-xs text-brand-700">{p.project_code}</span>
            {p.project_name}
          </p>
        </div>
        <PaymentActions payment={p} onEdit={onEdit} onDone={onDone} onError={onError} />
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

        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('payments.timeline.title')}</h3>
          <ol className="relative space-y-5 border-s border-ink-200 ps-5">
            {events.map((e) => (
              <li key={e.key} className="relative">
                <span className={`absolute -start-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${e.tone}`} />
                <p className="text-sm font-medium text-ink-900">{e.label}</p>
                <p className="text-xs text-ink-500">{formatDateTime(e.at, lang)} · {who(e.by)}</p>
                {e.note && <p dir="auto" className="mt-1 rounded-md bg-ink-50 px-2.5 py-1.5 text-sm text-ink-700">{e.note}</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {failed ? (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      ) : loaded ? (
        <PaymentJournal lines={loaded.lines} cashName={cashName} baseCurrency={access.currency} />
      ) : (
        <Spinner label={t('common.loading')} />
      )}
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
