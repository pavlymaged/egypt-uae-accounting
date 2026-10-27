import { Building2, ChevronRight, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/Feedback';
import { TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { formatAmount } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { COMPANY_COLUMNS, type Company } from '../../types';
import { CompanyStatusBadge, ServiceModelBadge } from './CompanyBadges';

export function CompaniesListPage({ mode }: { mode: 'all' | 'mine' }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const editable = mode === 'all';
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .order('code')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setCompanies((data ?? []) as unknown as Company[]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    if (!companies) return [];
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [companies, query]);

  const linkTo = (c: Company) => (editable ? `/companies/${c.id}` : `/my-companies/${c.id}`);
  const open = (c: Company) => navigate(linkTo(c));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={editable ? t('companies.title') : t('companies.myTitle')}
        subtitle={editable ? t('companies.subtitle') : t('companies.mySubtitle')}
        actions={
          editable && (
            <Button onClick={() => navigate('/companies/new')} icon={<Plus className="h-4 w-4" />}>
              {t('companies.new')}
            </Button>
          )
        }
      />

      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}

      {!failed && !companies && <Spinner label={t('common.loading')} />}

      {companies && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('companies.search')} aria-label={t('companies.search')} className="ps-9" />
            </div>
            <p className="text-xs text-ink-500">{t('companies.count', { n: filtered.length })}</p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title={query.trim() ? t('companies.emptySearch', { q: query.trim() }) : editable ? t('companies.empty') : t('companies.emptyMine')}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 bg-ink-50/60 text-start text-xs font-medium uppercase tracking-wide text-ink-500">
                      <th className="px-4 py-3 text-start">{t('companies.col.code')}</th>
                      <th className="px-4 py-3 text-start">{t('companies.col.name')}</th>
                      <th className="px-4 py-3 text-start">{t('companies.col.model')}</th>
                      <th className="px-4 py-3 text-start">{t('companies.col.status')}</th>
                      <th className="px-4 py-3 text-end">{t('companies.col.fee')}</th>
                      <th className="px-4 py-3 text-start">{t('companies.col.owner')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => open(c)}
                        className="cursor-pointer transition-colors hover:bg-brand-50/40"
                      >
                        <td className="px-4 py-3">
                          <Link to={linkTo(c)} onClick={(e) => e.stopPropagation()} dir="ltr" className="font-mono text-xs font-medium text-brand-700 hover:underline">
                            {c.code}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink-900">{c.name}</td>
                        <td className="px-4 py-3"><ServiceModelBadge model={c.service_model} /></td>
                        <td className="px-4 py-3"><CompanyStatusBadge status={c.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums text-ink-800" dir="ltr">
                          {formatAmount(c.monthly_service_fee, c.service_fee_currency)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-ink-800">{c.owner_name || <span className="text-ink-400">{t('common.notSet')}</span>}</p>
                          {c.owner_email && <p dir="ltr" className="text-xs text-ink-500 rtl:text-end">{c.owner_email}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-ink-100 md:hidden">
                {filtered.map((c) => {
                  const body = (
                    <div className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span dir="ltr" className="font-mono text-xs font-medium text-ink-500">{c.code}</span>
                          <CompanyStatusBadge status={c.status} />
                        </div>
                        <p className="font-medium text-ink-900">{c.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <ServiceModelBadge model={c.service_model} />
                          <span dir="ltr" className="text-sm tabular-nums text-ink-700">{formatAmount(c.monthly_service_fee, c.service_fee_currency)}</span>
                        </div>
                        {(c.owner_name || c.owner_email) && (
                          <p className="text-xs text-ink-500">
                            {c.owner_name}
                            {c.owner_name && c.owner_email && ' · '}
                            {c.owner_email && <span dir="ltr">{c.owner_email}</span>}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100" />
                    </div>
                  );
                  return (
                    <li key={c.id}>
                      <Link to={linkTo(c)} className="block transition-colors hover:bg-brand-50/40">{body}</Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
