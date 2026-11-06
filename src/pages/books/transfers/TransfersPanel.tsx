import { ArrowLeftRight, ArrowRight, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { ScreenErrorBoundary } from '../../../components/ui/ScreenErrorBoundary';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate, todayIn } from '../../../lib/dates';
import { supabase } from '../../../lib/supabase';
import type { BooksAccess } from '../books';
import { ListToolbar } from '../ListToolbar';
import { isZeroText } from '../entries/entries';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryStatusChips, ReturnNote, statusCounts, type StatusFilter } from '../entries/EntryListParts';
import { TransferDetail } from './TransferDetail';
import { TransferForm } from './TransferForm';
import {
  absText,
  asCashAccount,
  BALANCE_COLUMNS,
  isNegativeText,
  isTransferType,
  money,
  TRANSFER_COLUMNS,
  TRANSFER_TYPES,
  TYPE_LABEL,
  type BalanceAccount,
  type Transfer,
} from './transfers';

interface TransferData {
  transfers: Transfer[];
  accounts: BalanceAccount[];
  today: string;
}

type Notice = { tone: 'success' | 'error'; text: string };

export function TransfersPanel({ access }: { access: BooksAccess }) {
  return (
    <ScreenErrorBoundary>
      <TransfersView access={access} />
    </ScreenErrorBoundary>
  );
}

function TransfersView({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<TransferData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState<{ transfer: Transfer | null } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase
        .from('account_transfers_list')
        .select(TRANSFER_COLUMNS)
        .eq('company_id', access.companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('cash_account_balances').select(BALANCE_COLUMNS).eq('company_id', access.companyId).order('name'),
      supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([transfers, accounts, company]) => {
      if (cancelled) return;
      if (transfers.error || accounts.error || company.error || !Array.isArray(transfers.data) || !Array.isArray(accounts.data)) return setFailed(true);
      setData({
        transfers: transfers.data as unknown as Transfer[],
        accounts: accounts.data as unknown as BalanceAccount[],
        today: todayIn(company.data?.time_zone ?? null),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const counts = useMemo(() => statusCounts(data?.transfers ?? []), [data]);
  const cashAccounts = useMemo(() => (data?.accounts ?? []).map(asCashAccount), [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.transfers ?? []).filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!kind || r.transfer_type === kind) &&
        (!from || r.entry_date >= from) &&
        (!to || r.entry_date <= to) &&
        (!q || [r.from_name, r.to_name, r.from_code, r.to_code, r.notes, r.amount_out, r.amount_in].some((v) => String(v ?? '').toLowerCase().includes(q))),
    );
  }, [data, query, status, kind, from, to]);

  const openId = params.get('transfer');
  const openTransfer = data?.transfers.find((r) => r.entry_id === openId) ?? null;

  const showTransfer = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('transfer', id);
        else next.delete('transfer');
        return next;
      },
      { replace: !id },
    );

  const refresh = () => setAttempt((a) => a + 1);
  const done = (text: string) => {
    setNotice({ tone: 'success', text });
    setForm(null);
    refresh();
  };
  const refused = (text: string) => {
    setNotice({ tone: 'error', text });
    refresh();
  };

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={refresh}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data) return <Spinner label={t('common.loading')} />;

  const noticeEl = notice && <Alert tone={notice.tone}>{notice.text}</Alert>;
  const formEl = (
    <TransferForm
      open={!!form}
      access={access}
      transfer={form?.transfer ?? null}
      accounts={data.accounts}
      today={data.today}
      onClose={() => setForm(null)}
      onChanged={refresh}
      onDone={done}
    />
  );

  if (openId) {
    return (
      <div className="space-y-4">
        {noticeEl}
        {openTransfer ? (
          <TransferDetail
            transfer={openTransfer}
            access={access}
            accounts={cashAccounts}
            onBack={() => showTransfer(null)}
            onEdit={() => setForm({ transfer: openTransfer })}
            onDone={done}
            onError={refused}
          />
        ) : (
          <EmptyState icon={<ArrowLeftRight className="h-6 w-6" />} title={t('books.notFound')}>
            <Button variant="secondary" onClick={() => showTransfer(null)}>{t('transfers.backToList')}</Button>
          </EmptyState>
        )}
        {formEl}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{t('transfers.intro')}</p>
        {access.canRecord && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ transfer: null })}>{t('transfers.add')}</Button>
        )}
      </div>
      {noticeEl}

      <EntryStatusChips value={status} counts={counts} onChange={setStatus} />

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('transfers.search')}>
          <SelectInput aria-label={t('transfers.field.type')} value={kind} onChange={(e) => setKind(e.target.value)} className="w-48">
            <option value="">{t('transfers.allTypes')}</option>
            {TRANSFER_TYPES.map((k) => (
              <option key={k} value={k}>{t(TYPE_LABEL[k])}</option>
            ))}
          </SelectInput>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            {t('payments.from')}
            <TextInput type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            {t('payments.to')}
            <TextInput type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </label>
        </ListToolbar>

        {visible.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight className="h-6 w-6" />} title={data.transfers.length === 0 ? t('transfers.empty') : t('books.noMatch')}>
            {data.transfers.length === 0 && <p className="text-sm text-ink-500">{access.canRecord ? t('transfers.emptyHint') : t('transfers.emptyViewer')}</p>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((r) => (
              <li key={r.entry_id} className="transition-colors hover:bg-brand-50/30">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <button type="button" onClick={() => showTransfer(r.entry_id)} className="grid min-w-0 flex-1 gap-x-6 gap-y-2 rounded-lg text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:grid-cols-[8rem_1fr_auto]">
                    <div className="space-y-1">
                      <p className="text-sm font-medium tabular-nums text-ink-900">{formatDate(r.entry_date, lang)}</p>
                      <EntryStatusBadge status={r.status} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{isTransferType(r.transfer_type) ? t(TYPE_LABEL[r.transfer_type]) : r.transfer_type}</p>
                      <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium text-ink-900">
                        <span dir="auto" className="truncate">{r.from_name}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-400 rtl:-scale-x-100" />
                        <span dir="auto" className="truncate">{r.to_name}</span>
                      </p>
                      {(r.confirm_overdraw || r.confirm_over_owed) && (
                        <div className="flex flex-wrap gap-1.5">
                          {r.confirm_overdraw && <Badge tone="warning">{t('transfers.badge.overdraw')}</Badge>}
                          {r.confirm_over_owed && <Badge tone="warning">{t('transfers.badge.overOwed')}</Badge>}
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 sm:text-end">
                      <p dir="ltr" className="text-base font-semibold tabular-nums text-ink-900 rtl:text-end">
                        {money(r.amount_out, r.currency_out)}
                        {r.currency_out !== r.currency_in && <span className="text-sm font-medium text-ink-600">{` -> ${money(r.amount_in, r.currency_in)}`}</span>}
                      </p>
                      {!isZeroText(r.fx_difference) && (
                        <p className={`text-xs ${isNegativeText(r.fx_difference) ? 'text-red-700' : 'text-emerald-700'}`}>
                          {t(isNegativeText(r.fx_difference) ? 'transfers.fxLoss' : 'transfers.fxGain', { amount: money(absText(r.fx_difference), access.currency) })}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 lg:justify-end">
                    <EntryActions entry={r} kind="transfer" onEdit={() => setForm({ transfer: r })} onDone={done} onError={refused} />
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100 lg:block" />
                  </div>
                </div>
                {r.status === 'rejected' && r.reject_comment && <ReturnNote comment={r.reject_comment} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {formEl}
    </div>
  );
}
