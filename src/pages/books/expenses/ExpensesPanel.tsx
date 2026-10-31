import { ChevronRight, Plus, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ScreenErrorBoundary } from '../../../components/ui/ScreenErrorBoundary';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { TextInput } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate, todayIn } from '../../../lib/dates';
import { formatNumber } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { CASH_COLUMNS, PROJECT_COLUMNS, type BooksAccess, type CashAccount, type Project } from '../books';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryStatusChips, ReturnNote, statusCounts, type StatusFilter } from '../entries/EntryListParts';
import { ListToolbar } from '../ListToolbar';
import { ExpenseDetail } from './ExpenseDetail';
import { ExpenseEditor, type SavedResult } from './ExpenseEditor';
import type { LineContext } from './ExpenseLine';
import { BATCH_COLUMNS, type CostCentre, type ExpenseBatch, type ItemCode } from './expenses';

interface Loaded {
  batches: ExpenseBatch[];
  projects: Project[];
  accounts: CashAccount[];
  centres: CostCentre[];
  items: (ItemCode & { is_active: boolean })[];
  companyName: string;
  today: string;
}

type Notice = { tone: 'success' | 'error'; text: string };

export function ExpensesPanel({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('expense_batches_list').select(BATCH_COLUMNS).eq('company_id', access.companyId).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('projects').select(PROJECT_COLUMNS).eq('company_id', access.companyId).order('code'),
      supabase.from('cash_accounts').select(CASH_COLUMNS).eq('company_id', access.companyId).order('name'),
      supabase.from('cost_centres').select('code, name_en, name_ar').order('code'),
      supabase.from('item_codes').select('code, name_en, name_ar, scope, is_active').order('code'),
      supabase.from('companies').select('name, time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([batches, projects, accounts, centres, items, company]) => {
      if (cancelled) return;
      const lists = [batches, projects, accounts, centres, items];
      if (lists.some((r) => r.error || !Array.isArray(r.data)) || company.error) return setFailed(true);
      setData({
        batches: batches.data as unknown as ExpenseBatch[],
        projects: projects.data as unknown as Project[],
        accounts: accounts.data as CashAccount[],
        centres: centres.data as CostCentre[],
        items: items.data as (ItemCode & { is_active: boolean })[],
        companyName: (company.data?.name as string | undefined) ?? '',
        today: todayIn((company.data?.time_zone as string | undefined) ?? null),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const ctx = useMemo<LineContext | null>(() => {
    if (!data) return null;
    const projects = data.projects.filter((p) => p.is_active);
    const accounts = data.accounts.filter((a) => a.is_active);
    return {
      projects: [...projects.filter((p) => p.is_operation), ...projects.filter((p) => !p.is_operation)],
      accounts,
      accountById: new Map(data.accounts.map((a) => [a.id, a])),
      projectById: new Map(data.projects.map((p) => [p.id, p])),
      centres: data.centres,
      items: data.items.filter((i) => i.is_active),
      base: access.currency,
      companyName: data.companyName,
    };
  }, [data, access.currency]);

  const itemName = useMemo(() => new Map((data?.items ?? []).map((i) => [String(i.code), (lang === 'ar' && i.name_ar) || i.name_en])), [data, lang]);
  const counts = useMemo(() => statusCounts(data?.batches ?? []), [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.batches ?? []).filter(
      (b) => (status === 'all' || b.status === status) && (!from || b.entry_date >= from) && (!to || b.entry_date <= to) && (!q || (b.description ?? '').toLowerCase().includes(q)),
    );
  }, [data, query, status, from, to]);

  const go = (next: { batch?: string; edit?: string }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('batch');
        p.delete('edit');
        if (next.batch) p.set('batch', next.batch);
        if (next.edit) p.set('edit', next.edit);
        return p;
      },
      { replace: !next.batch && !next.edit },
    );

  const refresh = () => setAttempt((a) => a + 1);
  const done = (text: string) => {
    setNotice({ tone: 'success', text });
    refresh();
  };
  const refused = (text: string) => {
    setNotice({ tone: 'error', text });
    refresh();
  };
  const saved = (result: SavedResult) => {
    setNotice({ tone: result.tone, text: result.text });
    refresh();
    go({ batch: result.entryId });
  };

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={refresh}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data || !ctx) return <Spinner label={t('common.loading')} />;

  const noticeEl = notice && <Alert tone={notice.tone}>{notice.text}</Alert>;
  const notFound = (
    <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title={t('books.notFound')}>
      <Button variant="secondary" onClick={() => go({})}>{t('expenses.backToList')}</Button>
    </EmptyState>
  );

  const editId = params.get('edit');
  if (editId) {
    const editing = editId === 'new' ? null : data.batches.find((b) => b.entry_id === editId);
    const allowed = editId === 'new' ? access.canRecord : !!editing?.can_edit;
    if (!allowed) return notFound;
    return (
      <ScreenErrorBoundary key={editId}>
        <ExpenseEditor
          access={access}
          ctx={ctx}
          entryId={editing?.entry_id ?? null}
          today={data.today}
          onLeave={() => go(editing ? { batch: editing.entry_id } : {})}
          onSaved={saved}
        />
      </ScreenErrorBoundary>
    );
  }

  const openId = params.get('batch');
  if (openId) {
    const open = data.batches.find((b) => b.entry_id === openId);
    return (
      <div className="space-y-4">
        {noticeEl}
        {open ? (
          <ExpenseDetail
            batch={open}
            access={access}
            accounts={data.accounts}
            itemName={itemName}
            companyName={data.companyName}
            onBack={() => go({})}
            onEdit={() => go({ edit: open.entry_id })}
            onDone={done}
            onError={refused}
          />
        ) : (
          notFound
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{t('expenses.intro', { company: data.companyName })}</p>
        {access.canRecord && <Button icon={<Plus className="h-4 w-4" />} onClick={() => go({ edit: 'new' })}>{t('expenses.add')}</Button>}
      </div>
      {noticeEl}

      <EntryStatusChips value={status} counts={counts} onChange={setStatus} />

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('expenses.search')}>
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
          <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title={data.batches.length === 0 ? t('expenses.empty') : t('books.noMatch')}>
            {data.batches.length === 0 && <p className="max-w-md text-sm text-ink-500">{access.canRecord ? t('expenses.emptyHint') : t('expenses.emptyViewer')}</p>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((b) => (
              <li key={b.entry_id} className="transition-colors hover:bg-brand-50/30">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <button type="button" onClick={() => go({ batch: b.entry_id })} className="grid min-w-0 flex-1 gap-x-6 gap-y-2 rounded-lg text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:grid-cols-[7rem_1fr_auto]">
                    <div className="space-y-1">
                      <p className="text-sm font-medium tabular-nums text-ink-900">{formatDate(b.entry_date, lang)}</p>
                      <EntryStatusBadge status={b.status} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p dir="auto" className="truncate font-medium text-ink-900">{b.description || '-'}</p>
                      <p className="text-sm text-ink-500">{t('expenses.lines', { count: b.line_count })}</p>
                    </div>
                    <p dir="ltr" className="text-base font-semibold tabular-nums text-ink-900 rtl:text-end sm:text-end sm:rtl:text-start">
                      {b.base_total === null ? '-' : `${formatNumber(b.base_total, access.currency)} ${access.currency}`}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 lg:justify-end">
                    <EntryActions entry={b} kind="expense" onEdit={() => go({ edit: b.entry_id })} onDone={done} onError={refused} />
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100 lg:block" />
                  </div>
                </div>
                {b.status === 'rejected' && b.reject_comment && <ReturnNote comment={b.reject_comment} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
