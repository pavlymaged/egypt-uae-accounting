import { BadgePercent, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate } from '../../../lib/dates';
import { trimZeros } from '../../../lib/decimal';
import { formatNumber } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { CASH_COLUMNS, PROJECT_COLUMNS, type BooksAccess, type CashAccount, type Project } from '../books';
import { EntryActions, EntryStatusBadge } from '../entries/EntryActions';
import { EntryStatusChips, ReturnNote, statusCounts, type StatusFilter } from '../entries/EntryListParts';
import { ListToolbar } from '../ListToolbar';
import { FeeChargeDetail } from './FeeChargeDetail';
import { FeeChargeForm } from './FeeChargeForm';
import { FEE_CHARGE_COLUMNS, type FeeCharge } from './feeCharges';
import { FeeModeText } from './FeeModeText';

interface ChargeData {
  charges: FeeCharge[];
  projects: Project[];
  accounts: CashAccount[];
}

type Notice = { tone: 'success' | 'error'; text: string };

export function FeeChargesPanel({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ChargeData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState<{ charge: FeeCharge | null } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase
        .from('fee_charges_list')
        .select(FEE_CHARGE_COLUMNS)
        .eq('company_id', access.companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('projects').select(PROJECT_COLUMNS).eq('company_id', access.companyId).order('code'),
      supabase.from('cash_accounts').select(CASH_COLUMNS).eq('company_id', access.companyId).order('name'),
    ]).then(([charges, projects, accounts]) => {
      if (cancelled) return;
      if (charges.error || projects.error || accounts.error || ![charges.data, projects.data, accounts.data].every(Array.isArray)) return setFailed(true);
      setData({
        charges: charges.data as unknown as FeeCharge[],
        projects: projects.data as unknown as Project[],
        accounts: accounts.data as CashAccount[],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const counts = useMemo(() => statusCounts(data?.charges ?? []), [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.charges ?? []).filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (!projectFilter || c.project_id === projectFilter) &&
        (!from || c.entry_date >= from) &&
        (!to || c.entry_date <= to) &&
        (!q || [c.project_code, c.project_name, c.client_name, c.notes, c.account_name].some((v) => (v ?? '').toLowerCase().includes(q))),
    );
  }, [data, query, status, projectFilter, from, to]);

  const openId = params.get('charge');
  const openCharge = data?.charges.find((c) => c.entry_id === openId) ?? null;

  const showCharge = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('charge', id);
        else next.delete('charge');
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
    <FeeChargeForm
      open={!!form}
      access={access}
      charge={form?.charge ?? null}
      projects={data.projects}
      onClose={() => setForm(null)}
      onChanged={refresh}
      onDone={done}
    />
  );

  if (openId) {
    return (
      <div className="space-y-4">
        {noticeEl}
        {openCharge ? (
          <FeeChargeDetail
            charge={openCharge}
            access={access}
            accounts={data.accounts}
            onBack={() => showCharge(null)}
            onEdit={() => setForm({ charge: openCharge })}
            onDone={done}
            onError={refused}
          />
        ) : (
          <EmptyState icon={<BadgePercent className="h-6 w-6" />} title={t('books.notFound')}>
            <Button variant="secondary" onClick={() => showCharge(null)}>{t('feeCharges.backToList')}</Button>
          </EmptyState>
        )}
        {formEl}
      </div>
    );
  }

  const fixedProjects = data.projects.filter((p) => p.fee_method === 'fixed' && !p.is_operation);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{t('feeCharges.intro')}</p>
        {access.canRecord && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ charge: null })}>{t('feeCharges.add')}</Button>}
      </div>
      {noticeEl}

      <EntryStatusChips value={status} counts={counts} onChange={setStatus} />

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('feeCharges.search')}>
          <SelectInput aria-label={t('payments.field.project')} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-52">
            <option value="">{t('payments.allProjects')}</option>
            {fixedProjects.map((p) => (
              <option key={p.id} value={p.id}>{`${p.code} - ${p.name}`}</option>
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
          <EmptyState icon={<BadgePercent className="h-6 w-6" />} title={data.charges.length === 0 ? t('feeCharges.empty') : t('books.noMatch')}>
            {data.charges.length === 0 && <p className="max-w-md text-sm text-ink-500">{access.canRecord ? t('feeCharges.emptyHint') : t('feeCharges.emptyViewer')}</p>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((c) => (
              <li key={c.entry_id} className="transition-colors hover:bg-brand-50/30">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <button type="button" onClick={() => showCharge(c.entry_id)} className="group grid min-w-0 flex-1 gap-x-6 gap-y-2 rounded-lg text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:grid-cols-[7rem_1fr_auto]">
                    <div className="space-y-1">
                      <p className="text-sm font-medium tabular-nums text-ink-900">{formatDate(c.entry_date, lang)}</p>
                      <EntryStatusBadge status={c.status} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium text-ink-900">
                        <span dir="ltr" className="me-2 font-mono text-xs text-brand-700">{c.project_code}</span>
                        {c.project_name}
                      </p>
                      <p className="truncate text-sm text-ink-600">{c.client_name ?? '-'}</p>
                      <p className="truncate text-xs text-ink-500"><FeeModeText charge={c} /></p>
                    </div>
                    <div className="space-y-0.5 sm:text-end">
                      <p dir="ltr" className="text-base font-semibold tabular-nums text-ink-900 rtl:text-end">{`${formatNumber(c.amount, c.currency)} ${c.currency}`}</p>
                      <p className="text-xs text-ink-500">{t('feeCharges.atPercent', { percent: trimZeros(c.milestone_percent) })}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 lg:justify-end">
                    <EntryActions entry={c} kind="feeCharge" onEdit={() => setForm({ charge: c })} onDone={done} onError={refused} />
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100 lg:block" />
                  </div>
                </div>
                {c.status === 'rejected' && c.reject_comment && <ReturnNote comment={c.reject_comment} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {formEl}
    </div>
  );
}
