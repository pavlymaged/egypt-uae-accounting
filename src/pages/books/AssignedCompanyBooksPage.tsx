import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStaff } from '../../auth/SessionProvider';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { Alert, PageHeader, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { COMPANY_COLUMNS, type Company } from '../../types';
import { CompanyStatusBadge } from '../companies/CompanyBadges';
import { BOOK_TABS, CompanyTabs, isBookTab, useCompanyTab } from '../companies/CompanyTabs';
import { NotFoundPage } from '../NotFoundPage';
import { BookPanel } from './BookPanel';
import { staffBooksAccess } from './books';

export function AssignedCompanyBooksPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const staff = useStaff();
  const [company, setCompany] = useState<Company | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'notFound'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useCompanyTab(BOOK_TABS);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .eq('id', id ?? '')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setState('failed');
        if (!data) return setState('notFound');
        setCompany(data as unknown as Company);
        setState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const access = company && staff ? staffBooksAccess(staff.staff_role, company, null) : null;
  if (state === 'notFound') return <NotFoundPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        back={<BackLink to="/my-companies" label={t('nav.myCompanies')} />}
        title={company?.name ?? ''}
        subtitle={company ? company.code : undefined}
        actions={company ? <CompanyStatusBadge status={company.status} /> : null}
      />
      {state === 'loading' && <Spinner label={t('common.loading')} />}
      {state === 'failed' && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {state === 'ready' && !access && <Alert tone="info">{t('books.notFound')}</Alert>}
      {state === 'ready' && access && (
        <>
          <CompanyTabs tabs={BOOK_TABS} tab={tab} onChange={setTab} />
          {isBookTab(tab) && <BookPanel section={tab} access={access} />}
        </>
      )}
    </div>
  );
}
