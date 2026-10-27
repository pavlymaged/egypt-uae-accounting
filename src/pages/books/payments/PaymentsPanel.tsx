import { ChevronRight, Plus, Receipt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate, todayIn } from '../../../lib/dates';
import { formatNumber } from '../../../lib/money';
import { ratePercent } from '../../../lib/rates';
import { supabase } from '../../../lib/supabase';
import { CASH_COLUMNS, PROJECT_COLUMNS, type BooksAccess, type CashAccount, type Project } from '../books';
import { ListToolbar } from '../ListToolbar';
import { PaymentActions, PaymentStatusBadge } from './PaymentActions';
import { PaymentDetail } from './PaymentDetail';
import { PaymentForm } from './PaymentForm';
import { PAYMENT_COLUMNS, PAYMENT_STATUSES, STATUS_LABEL, isZeroText, type Payment, type PaymentStatus } from './payments';

interface PaymentData {
  payments: Payment[];
  projects: Project[];
  accounts: CashAccount[];
  today: string;
}

type Notice = { tone: 'success' | 'error'; text: string };

export function PaymentsPanel({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<PaymentData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState<{ payment: Payment | null } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase
        .from('client_payments_list')
        .select(PAYMENT_COLUMNS)
        .eq('company_id', access.companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('projects').select(PROJECT_COLUMNS).eq('company_id', access.companyId).order('code'),
      supabase.from('cash_accounts').select(CASH_COLUMNS).eq('company_id', access.companyId).order('name'),
      supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([payments, projects, accounts, company]) => {
      if (cancelled) return;
      if (payments.error || projects.error || accounts.error || company.error || ![payments.data, projects.data, accounts.data].every(Array.isArray)) {
        return setFailed(true);
      }
      setData({
        payments: payments.data as unknown as Payment[],
        projects: projects.data as unknown as Project[],
        accounts: accounts.data as CashAccount[],
        today: todayIn(company.data?.time_zone ?? null),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const counts = useMemo(() => {
    const result = new Map<PaymentStatus | 'all', number>([['all', data?.payments.length ?? 0]]);
    (data?.payments ?? []).forEach((p) => result.set(p.status, (result.get(p.status) ?? 0) + 1));
    return result;
  }, [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.payments ?? []).filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (!projectFilter || p.project_id === projectFilter) &&
        (!from || p.entry_date >= from) &&
        (!to || p.entry_date <= to) &&
        (!q || [p.project_code, p.project_name, p.client_name, p.notes, p.received_by].some((v) => (v ?? '').toLowerCase().includes(q))),
    );
  }, [data, query, status, projectFilter, from, to]);

  const openId = params.get('payment');
  const openPayment = data?.payments.find((p) => p.entry_id === openId) ?? null;

  const showPayment = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('payment', id);
        else next.delete('payment');
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
    <PaymentForm
      open={!!form}
      access={access}
      payment={form?.payment ?? null}
      projects={data.projects}
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
        {openPayment ? (
          <PaymentDetail
            payment={openPayment}
            access={access}
            accounts={data.accounts}
            onBack={() => showPayment(null)}
            onEdit={() => setForm({ payment: openPayment })}
            onDone={done}
            onError={refused}
          />
        ) : (
          <EmptyState icon={<Receipt className="h-6 w-6" />} title={t('books.notFound')}>
            <Button variant="secondary" onClick={() => showPayment(null)}>{t('payments.backToList')}</Button>
          </EmptyState>
        )}
        {formEl}
      </div>
    );
  }

  const filterProjects = data.projects.filter((p) => !p.is_operation);
  const chips: (PaymentStatus | 'all')[] = ['all', ...PAYMENT_STATUSES];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{access.selfService ? t('payments.introSelf') : t('payments.introManaged')}</p>
        {access.canRecord && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ payment: null })}>{t('payments.add')}</Button>
        )}
      </div>
      {noticeEl}

      <div role="tablist" aria-label={t('books.col.status')} className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const selected = status === chip;
          return (
            <button
              key={chip}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStatus(chip)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              {chip === 'all' ? t('books.filter.all') : t(STATUS_LABEL[chip])}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'}`}>{counts.get(chip) ?? 0}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('payments.search')}>
          <SelectInput aria-label={t('payments.field.project')} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-52">
            <option value="">{t('payments.allProjects')}</option>
            {filterProjects.map((p) => (
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
          <EmptyState icon={<Receipt className="h-6 w-6" />} title={data.payments.length === 0 ? t('payments.empty') : t('books.noMatch')}>
            {data.payments.length === 0 && <p className="text-sm text-ink-500">{access.canRecord ? t('payments.emptyHint') : t('payments.emptyViewer')}</p>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((p) => (
              <li key={p.entry_id} className="transition-colors hover:bg-brand-50/30">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <button type="button" onClick={() => showPayment(p.entry_id)} className="group grid min-w-0 flex-1 gap-x-6 gap-y-2 text-start sm:grid-cols-[7rem_1fr_auto] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm font-medium tabular-nums text-ink-900">{formatDate(p.entry_date, lang)}</p>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium text-ink-900">
                        <span dir="ltr" className="me-2 font-mono text-xs text-brand-700">{p.project_code}</span>
                        {p.project_name}
                      </p>
                      <p className="truncate text-sm text-ink-600">{p.client_name ?? '-'}</p>
                      <p className="truncate text-xs text-ink-500">{t('payments.intoAccount', { account: p.account_name })}</p>
                    </div>
                    <div className="space-y-0.5 sm:text-end">
                      <p dir="ltr" className="text-base font-semibold tabular-nums text-ink-900 rtl:text-end">{`${formatNumber(p.amount, p.currency)} ${p.currency}`}</p>
                      <p className="text-xs text-ink-500">
                        {isZeroText(p.fee_amount) ? (
                          t('payments.noFeeShort')
                        ) : (
                          <>
                            {t('payments.col.fee')}: <span dir="ltr" className="tabular-nums">{`${formatNumber(p.fee_amount, p.currency)} ${p.currency}`}</span>
                            {' '}<span dir="ltr">({ratePercent(p.fee_rate)})</span>
                          </>
                        )}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 lg:justify-end">
                    <PaymentActions payment={p} onEdit={() => setForm({ payment: p })} onDone={done} onError={refused} />
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100 lg:block" />
                  </div>
                </div>
                {p.status === 'rejected' && p.reject_comment && (
                  <div className="px-4 pb-4">
                    <div className="rounded-lg border-s-4 border-amber-500 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                      <span className="font-semibold">{t('payments.returnComment')}: </span>
                      <span dir="auto">{p.reject_comment}</span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {formEl}
    </div>
  );
}
