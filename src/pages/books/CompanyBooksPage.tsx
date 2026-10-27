import { useEffect, useState } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, PageHeader, Spinner } from '../../components/ui/Feedback';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import type { Company } from '../../types';
import { NotFoundPage } from '../NotFoundPage';
import { BookPanel, type BookSection } from './BookPanel';
import { memberBooksAccess, type BooksAccess } from './books';

const TITLES: Record<BookSection, { title: TranslationKey; subtitle: TranslationKey }> = {
  projects: { title: 'nav.projects', subtitle: 'projects.subtitle' },
  clients: { title: 'nav.clients', subtitle: 'clients.subtitle' },
  cash: { title: 'nav.cashAccounts', subtitle: 'cash.subtitle' },
};

export function CompanyBooksPage({ section }: { section: BookSection }) {
  const { t } = useI18n();
  const { identity, activeCompany, session } = useSession();
  const membership = identity?.kind === 'company' && activeCompany && (activeCompany.role === 'owner' || activeCompany.role === 'bookkeeper') ? activeCompany : null;
  const userId = session?.user.id;
  const [access, setAccess] = useState<BooksAccess | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'notFound'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!membership || !userId) return;
    let cancelled = false;
    setState('loading');
    Promise.all([
      supabase.from('companies').select('id, service_model, status, base_currency').eq('id', membership.company_id).maybeSingle(),
      supabase.from('company_users').select('can_record').eq('company_id', membership.company_id).eq('user_id', userId).maybeSingle(),
    ]).then(([company, me]) => {
      if (cancelled) return;
      if (company.error || me.error) return setState('failed');
      if (!company.data || !me.data) return setState('notFound');
      const row = company.data as Pick<Company, 'id' | 'service_model' | 'status' | 'base_currency'>;
      setAccess(memberBooksAccess(membership.role, (me.data as { can_record: boolean }).can_record === true, row));
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [membership, userId, attempt]);

  if (!membership || state === 'notFound') return <NotFoundPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title={t(TITLES[section].title)} subtitle={t(TITLES[section].subtitle)} />
      {state === 'loading' && <Spinner label={t('common.loading')} />}
      {state === 'failed' && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {state === 'ready' && access && <BookPanel section={section} access={access} />}
    </div>
  );
}
