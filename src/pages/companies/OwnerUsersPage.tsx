import { useEffect, useState } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, PageHeader, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import type { Company } from '../../types';
import { NotFoundPage } from '../NotFoundPage';
import { CompanyUsersPanel } from './CompanyUsersPanel';

type OwnerCompany = Pick<Company, 'id' | 'service_model' | 'status'>;

export function OwnerUsersPage() {
  const { t } = useI18n();
  const { activeCompany } = useSession();
  const isOwner = activeCompany?.role === 'owner';
  const companyId = activeCompany?.company_id;
  const [company, setCompany] = useState<OwnerCompany | null | 'notFound'>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOwner || !companyId) return;
    let cancelled = false;
    setFailed(false);
    supabase
      .from('companies')
      .select('id, service_model, status')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setFailed(true);
        setCompany((data as OwnerCompany | null) ?? 'notFound');
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, companyId, attempt]);

  if (!isOwner || company === 'notFound') return <NotFoundPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('cusers.title')} subtitle={t('cusers.ownerSubtitle', { company: activeCompany?.company.name ?? '' })} />
      {failed ? (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      ) : company ? (
        <CompanyUsersPanel company={company} asAdmin={false} />
      ) : (
        <Spinner label={t('common.loading')} />
      )}
    </div>
  );
}
