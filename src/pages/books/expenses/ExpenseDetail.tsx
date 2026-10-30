import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate } from '../../../lib/dates';
import { trimZeros } from '../../../lib/decimal';
import { formatNumber } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import type { BooksAccess, CashAccount } from '../books';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryJournalSection, EntryTimeline, useEntryTrail } from '../entries/EntryTrail';
import { LINE_COLUMNS, type ExpenseBatch, type ExpenseLine } from './expenses';

interface Props {
  batch: ExpenseBatch;
  access: BooksAccess;
  accounts: CashAccount[];
  itemName: Map<string, string>;
  companyName: string;
  onBack: () => void;
  onEdit: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

const SAFE_LINK = /^https?:\/\//i;

export function ExpenseDetail({ batch: b, access, accounts, itemName, companyName, onBack, onEdit, onDone, onError }: Props) {
  const { t, lang } = useI18n();
  const trail = useEntryTrail(b, access.companyId);
  const [lines, setLines] = useState<ExpenseLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('expense_lines_list')
      .select(LINE_COLUMNS)
      .eq('entry_id', b.entry_id)
      .order('line_no')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setLines(data as unknown as ExpenseLine[]);
      });
    return () => {
      cancelled = true;
    };
  }, [b.entry_id, b.status, attempt]);

  const money = (value: string | null, currency = access.currency) => <span dir="ltr" className="tabular-nums">{value === null ? '-' : `${formatNumber(value, currency)} ${currency}`}</span>;

  return (
    <div className="animate-fade-in space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('expenses.backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <EntryStatusBadge status={b.status} />
            <span className="text-sm text-ink-500">{formatDate(b.entry_date, lang)}</span>
            <span className="text-sm text-ink-400">·</span>
            <span className="text-sm text-ink-500">{t('expenses.lines', { count: b.line_count })}</span>
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">{money(b.base_total)}</h2>
          <p dir="auto" className="text-sm text-ink-600">{b.description || '-'}</p>
        </div>
        <EntryActions entry={b} kind="expense" onEdit={onEdit} onDone={onDone} onError={onError} />
      </div>

      {b.status === 'rejected' && b.reject_comment && <Alert tone="warning">{t('expenses.returnedWith', { comment: b.reject_comment })}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-ink-900">{t('expenses.linesTitle')}</h3>
          </div>
          {failed ? (
            <div className="p-5">
              <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
                {t('common.loadFailed')}
              </Alert>
            </div>
          ) : !lines ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {lines.map((l) => (
                <li key={l.line_no} className="grid gap-x-6 gap-y-3 p-5 md:grid-cols-[2.5rem_1fr_auto]">
                  <span className="text-xs font-semibold tabular-nums text-ink-400">{l.line_no}</span>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p dir="auto" className="font-medium text-ink-900">{l.description}</p>
                      {l.is_return && <Badge tone="sky">{t('expenses.returnBadge')}</Badge>}
                      {l.dup_confirmed && <Badge tone="gold">{t('expenses.dupConfirmed')}</Badge>}
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <Item label={t('payments.field.date')}>{formatDate(l.line_date, lang)}</Item>
                      <Item label={t('payments.field.project')}>
                        {l.is_operation ? t('expenses.operation') : `${l.project_code} - ${l.project_name}`}
                        <span className={`ms-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${l.is_operation ? 'bg-ink-100 text-ink-700' : 'bg-sky-50 text-sky-800'}`}>
                          {l.is_operation ? t('expenses.companyCost', { company: companyName }) : t('expenses.chargedToClient')}
                        </span>
                      </Item>
                      <Item label={t('expenses.field.account')}>{`${l.account_name} (${l.currency})`}</Item>
                      <Item label={t('expenses.field.category')}>{`${l.category}${l.category_name ? ` · ${l.category_name}` : ''}`}</Item>
                      <Item label={t('expenses.field.item')}>
                        <span dir="ltr" className="me-1.5 font-mono text-xs text-brand-700">{l.item_code}</span>
                        {(lang === 'ar' ? l.item_name_ar : l.item_name) ?? ''}
                      </Item>
                      <Item label={t('expenses.field.receipt')}>
                        {l.receipt_link && SAFE_LINK.test(l.receipt_link) ? (
                          <a href={l.receipt_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                            {t('expenses.openReceipt')}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          '-'
                        )}
                      </Item>
                    </dl>
                  </div>
                  <div className="space-y-1 md:text-end">
                    <p dir="ltr" className="text-base font-semibold tabular-nums text-ink-900 rtl:text-end md:rtl:text-start">{`${l.is_return ? '-' : ''}${formatNumber(l.amount, l.currency)} ${l.currency}`}</p>
                    {l.currency !== access.currency && (
                      <p dir="ltr" className="text-xs tabular-nums text-ink-500 rtl:text-end md:rtl:text-start">{`1 ${l.currency} = ${l.rate ? trimZeros(l.rate) : '-'} ${access.currency}`}</p>
                    )}
                    <p className="text-sm text-ink-600">{money(l.base_amount)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <EntryTimeline entry={b} trail={trail} />
      </div>

      <EntryJournalSection trail={trail} access={access} accounts={accounts} itemName={itemName} />
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd dir="auto" className="text-ink-900">{children}</dd>
    </div>
  );
}
