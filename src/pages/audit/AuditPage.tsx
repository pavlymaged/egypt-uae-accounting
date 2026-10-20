import { ChevronLeft, ChevronRight, History, RotateCcw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSession, useStaff } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime } from '../../lib/dates';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { NotFoundPage } from '../NotFoundPage';
import { ACTION_TONE, AuditDetailPanel } from './AuditDetailPanel';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, actionLabel, entityLabel, recordName, type AuditEntry } from './auditFormat';

const PAGE_SIZE = 50;

interface Filters {
  company: string;
  action: string;
  entity: string;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { company: '', action: '', entity: '', from: '', to: '' };

function startOfDay(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function startOfNextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

type ChainResult = { kind: 'intact' } | { kind: 'damaged'; at: number } | { kind: 'error'; msg: string };

export function AuditPage({ mode }: { mode: 'all' | 'company' }) {
  const { t, lang } = useI18n();
  const staff = useStaff();
  const { activeCompany } = useSession();
  const isOwner = activeCompany?.role === 'owner';
  const ownCompanyId = mode === 'company' ? activeCompany?.company_id : undefined;
  const isSuperAdmin = mode === 'all' && staff?.staff_role === 'super_admin';

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [companies, setCompanies] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [chain, setChain] = useState<ChainResult | null>(null);

  useEffect(() => {
    if (mode !== 'all') return;
    supabase
      .from('companies')
      .select('id, name, code')
      .order('name')
      .then(({ data }) => setCompanies(data ?? []));
  }, [mode]);

  useEffect(() => {
    if (mode === 'company' && (!isOwner || !ownCompanyId)) return;
    if (filters.from && filters.to && filters.from > filters.to) {
      setDateError(t('audit.dateOrder'));
      return;
    }
    setDateError(null);
    let cancelled = false;
    setFailed(false);
    setRows(null);
    let query = supabase
      .from('audit_trail_named')
      .select('id, occurred_at, actor_user_id, actor_name, company_id, company_code, company_name, scope, action, entity_type, entity_id, details')
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false });
    const companyId = ownCompanyId ?? filters.company;
    if (companyId) query = query.eq('company_id', companyId);
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.entity) query = query.eq('entity_type', filters.entity);
    if (filters.from) query = query.gte('occurred_at', startOfDay(filters.from));
    if (filters.to) query = query.lt('occurred_at', startOfNextDay(filters.to));
    query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).then(({ data, error }) => {
      if (cancelled) return;
      if (error) return setFailed(true);
      const list = (data ?? []) as AuditEntry[];
      setHasNext(list.length > PAGE_SIZE);
      setRows(list.slice(0, PAGE_SIZE));
    });
    return () => {
      cancelled = true;
    };
  }, [mode, isOwner, ownCompanyId, filters, page, attempt, t]);

  const closePanel = useCallback(() => setSelected(null), []);

  if (mode === 'company' && !isOwner) return <NotFoundPage />;

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  async function verifyChain() {
    setVerifying(true);
    setChain(null);
    const { data, error } = await supabase.rpc('verify_audit_chain');
    setVerifying(false);
    if (error) return setChain({ kind: 'error', msg: isNetworkError(error) ? t('common.networkError') : t('audit.verifyFailed', { msg: error.message }) });
    if (data === null) return setChain({ kind: 'intact' });
    setChain({ kind: 'damaged', at: Number(data) });
  }

  const filtersActive = Object.entries(filters).some(([k, v]) => v && (k !== 'company' || mode === 'all'));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={mode === 'all' ? t('nav.audit') : t('nav.activity')}
        subtitle={mode === 'all' ? t('audit.subtitle') : t('audit.ownerSubtitle', { company: activeCompany?.company.name ?? '' })}
        actions={
          isSuperAdmin ? (
            <Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />} loading={verifying} onClick={() => void verifyChain()}>
              {t('audit.verify')}
            </Button>
          ) : undefined
        }
      />

      {chain && (
        <div className="mb-4">
          {chain.kind === 'intact' && <Alert tone="success">{t('audit.chainIntact')}</Alert>}
          {chain.kind === 'damaged' && (
            <Alert tone="error">
              <span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" />{t('audit.chainDamaged', { n: chain.at })}</span>
            </Alert>
          )}
          {chain.kind === 'error' && <Alert tone="error">{chain.msg}</Alert>}
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className={`grid gap-4 sm:grid-cols-2 ${mode === 'all' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {mode === 'all' && (
            <Field label={t('audit.col.company')}>
              {(id) => (
                <SelectInput id={id} value={filters.company} onChange={(e) => setFilter('company', e.target.value)}>
                  <option value="">{t('audit.allCompanies')}</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </SelectInput>
              )}
            </Field>
          )}
          <Field label={t('audit.col.action')}>
            {(id) => (
              <SelectInput id={id} value={filters.action} onChange={(e) => setFilter('action', e.target.value)}>
                <option value="">{t('audit.allActions')}</option>
                {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a, t)}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label={t('audit.col.record')}>
            {(id) => (
              <SelectInput id={id} value={filters.entity} onChange={(e) => setFilter('entity', e.target.value)}>
                <option value="">{t('audit.allRecords')}</option>
                {AUDIT_ENTITIES.map((en) => <option key={en} value={en}>{entityLabel(en, t)}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label={t('audit.from')} error={dateError}>
            {(id, d, invalid) => <TextInput id={id} type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-describedby={d} invalid={invalid} />}
          </Field>
          <Field label={t('audit.to')}>
            {(id) => <TextInput id={id} type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />}
          </Field>
        </div>
        {filtersActive && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setFilters(NO_FILTERS); setPage(0); }}>
              {t('audit.clearFilters')}
            </Button>
          </div>
        )}
      </Card>

      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !rows && !dateError && <Spinner label={t('common.loading')} />}

      {rows && rows.length === 0 && (
        <Card>
          <EmptyState icon={<History className="h-6 w-6" />} title={filtersActive ? t('audit.emptyFiltered') : t('audit.empty')} />
        </Card>
      )}

      {rows && rows.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {rows.map((r) => {
              const name = recordName(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-start transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="w-36 shrink-0 text-xs text-ink-500 sm:text-sm">{formatDateTime(r.occurred_at, lang)}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Badge tone={ACTION_TONE[r.action] ?? 'neutral'}>{actionLabel(r.action, t)}</Badge>
                      <span className="text-sm text-ink-600">{entityLabel(r.entity_type, t)}</span>
                      {name && <span className="truncate text-sm font-medium text-ink-900">{name}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col text-xs text-ink-500 sm:items-end sm:text-sm">
                      <span className="text-ink-700">{r.actor_name ?? t('audit.system')}</span>
                      {mode === 'all' && r.company_name && <span>{r.company_name}</span>}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-300 sm:block rtl:rotate-180" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-ink-200 bg-ink-50/60 px-4 py-3">
            <span className="text-sm text-ink-500">{t('audit.pageInfo', { from: page * PAGE_SIZE + 1, to: page * PAGE_SIZE + rows.length })}</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-4 w-4 rtl:rotate-180" />}>
                {t('audit.newer')}
              </Button>
              <Button variant="secondary" disabled={!hasNext} onClick={() => setPage((p) => p + 1)} icon={<ChevronRight className="h-4 w-4 rtl:rotate-180" />}>
                {t('audit.older')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <AuditDetailPanel entry={selected} onClose={closePanel} />
    </div>
  );
}
