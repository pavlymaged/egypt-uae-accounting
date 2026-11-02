import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { SelectInput, TextInput } from '../../components/ui/Field';
import { ScreenErrorBoundary } from '../../components/ui/ScreenErrorBoundary';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { CASH_COLUMNS, type BooksAccess, type CashAccount } from '../books/books';
import { loadPeopleNames } from '../books/entries/EntryTrail';
import { ListToolbar } from '../books/ListToolbar';
import { ClaimActions, hasClaimActions } from './ClaimActions';
import { ClaimDetail } from './ClaimDetail';
import { CLAIM_COLUMNS, CLAIM_STATES, STATE_LABEL, type ClaimState, type SiteClaim } from './claims';
import { ClaimStateBadge, Money, OfficeComment, ReceiptLink } from './ClaimParts';

type CashRow = CashAccount & { engineer_user_id: string | null };
type Filter = 'all' | ClaimState;
type Notice = { tone: 'success' | 'error'; text: string };

interface Loaded {
  claims: SiteClaim[];
  accounts: CashRow[];
  custodyName: Map<string, string>;
}

export function SiteClaimsPanel({ access }: { access: BooksAccess }) {
  return (
    <ScreenErrorBoundary>
      <ClaimsScreen access={access} />
    </ScreenErrorBoundary>
  );
}

function ClaimsScreen({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Filter>('all');
  const [engineer, setEngineer] = useState('');
  const [project, setProject] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      const [claims, accounts] = await Promise.all([
        supabase.from('site_claims_list').select(CLAIM_COLUMNS).eq('company_id', access.companyId).order('claim_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('cash_accounts').select(`${CASH_COLUMNS}, engineer_user_id`).eq('company_id', access.companyId),
      ]);
      if (cancelled) return;
      if (claims.error || !Array.isArray(claims.data) || accounts.error || !Array.isArray(accounts.data)) return setFailed(true);
      const rows = accounts.data as unknown as CashRow[];
      const people = await loadPeopleNames(access.companyId, rows.map((a) => a.engineer_user_id));
      if (cancelled) return;
      const custodyName = new Map<string, string>();
      for (const a of rows) if (a.kind === 'custody' && a.engineer_user_id) custodyName.set(a.code, people.get(a.engineer_user_id) ?? a.name);
      setData({ claims: claims.data as unknown as SiteClaim[], accounts: rows, custodyName });
    })();
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const cashName = useMemo(() => new Map((data?.accounts ?? []).map((a) => [a.code, a.name])), [data]);
  const engineers = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data?.claims ?? []) m.set(c.engineer_user_id, c.engineer_name ?? '-');
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const projects = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data?.claims ?? []) m.set(c.project_id, `${c.project_code ?? ''} ${c.project_name ?? ''}`.trim());
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const base = useMemo(
    () =>
      (data?.claims ?? []).filter(
        (c) => (!engineer || c.engineer_user_id === engineer) && (!project || c.project_id === project) && (!from || c.claim_date >= from) && (!to || c.claim_date <= to),
      ),
    [data, engineer, project, from, to],
  );
  const counts = useMemo(() => {
    const out: Record<Filter, number> = { all: base.length, submitted: 0, pre_approved: 0, approved: 0, rejected: 0, reversed: 0, cancelled: 0 };
    for (const c of base) if (c.state in out) out[c.state] += 1;
    return out;
  }, [base]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((c) => (status === 'all' || c.state === status) && (!q || String(c.description ?? '').toLowerCase().includes(q)));
  }, [base, status, query]);

  const refresh = () => setAttempt((a) => a + 1);
  const done = (text: string) => {
    setNotice({ tone: 'success', text });
    refresh();
  };
  const refused = (text: string) => {
    setNotice({ tone: 'error', text });
    refresh();
  };
  const openClaim = (id: string | null) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (id) p.set('claim', id);
        else p.delete('claim');
        return p;
      },
      { replace: !id },
    );

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={refresh}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data) return <Spinner label={t('common.loading')} />;

  const noticeEl = notice && <Alert tone={notice.tone}>{notice.text}</Alert>;
  const openId = params.get('claim');
  if (openId) {
    const open = data.claims.find((c) => c.claim_id === openId);
    return (
      <div className="space-y-4">
        {noticeEl}
        {open ? (
          <ClaimDetail claim={open} currency={access.currency} cashName={cashName} custodyName={data.custodyName} onBack={() => openClaim(null)} onDone={done} onError={refused} />
        ) : (
          <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title={t('books.notFound')}>
            <Button variant="secondary" onClick={() => openClaim(null)}>{t('claims.back')}</Button>
          </EmptyState>
        )}
      </div>
    );
  }

  const filters: Filter[] = ['all', ...CLAIM_STATES];

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{access.selfService ? t('claims.howSelf') : t('claims.howManaged')}</p>
      {noticeEl}

      <div className="flex flex-wrap gap-2" role="tablist">
        {filters.map((f) => {
          const active = status === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(f)}
              className={`inline-flex min-h-[2.25rem] items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              {f === 'all' ? t('books.filter.all') : t(STATE_LABEL[f])}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'}`}>{counts[f]}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('claims.search')}>
          <SelectInput value={engineer} onChange={(e) => setEngineer(e.target.value)} className="w-44" aria-label={t('claims.engineer')}>
            <option value="">{t('claims.allEngineers')}</option>
            {engineers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </SelectInput>
          <SelectInput value={project} onChange={(e) => setProject(e.target.value)} className="w-48" aria-label={t('claims.field.project')}>
            <option value="">{t('claims.allProjects')}</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
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
          <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title={data.claims.length === 0 ? t('claims.empty') : t('claims.emptyFiltered')}>
            {data.claims.length === 0 && <p className="max-w-md text-sm text-ink-500">{t('claims.emptyHint')}</p>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((c) => (
              <li key={c.claim_id} className="transition-colors hover:bg-brand-50/30">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <button
                    type="button"
                    onClick={() => openClaim(c.claim_id)}
                    className="grid min-w-0 flex-1 gap-x-6 gap-y-2 rounded-lg text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:grid-cols-[7rem_1fr_auto]"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium tabular-nums text-ink-900">{formatDate(c.claim_date, lang)}</p>
                      <ClaimStateBadge state={c.state} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium text-ink-900">{c.engineer_name ?? '-'}</p>
                      <p className="truncate text-sm text-ink-600">
                        <span dir="ltr" className="font-mono text-xs text-ink-500">{c.project_code ?? ''}</span> {c.project_name ?? ''}
                      </p>
                      {c.description && <p dir="auto" className="truncate text-sm text-ink-500">{c.description}</p>}
                    </div>
                    <Money value={c.amount} currency={access.currency} className="text-base font-semibold text-ink-900 sm:text-end" />
                  </button>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <ReceiptLink link={c.receipt_link} />
                    {hasClaimActions(c) && <ClaimActions claim={c} onDone={done} onError={refused} />}
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100 lg:block" />
                  </div>
                </div>
                {c.state === 'rejected' && c.reject_comment && (
                  <div className="px-4 pb-4">
                    <OfficeComment comment={c.reject_comment} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
