import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, PageHeader, Spinner } from '../../../components/ui/Feedback';
import { ScreenErrorBoundary } from '../../../components/ui/ScreenErrorBoundary';
import { useI18n } from '../../../i18n/I18nProvider';
import { NotFoundPage } from '../../NotFoundPage';
import { useEngineerCompany, type EngineerCompany } from './useEngineerCompany';

export function EngineerScreen({ title, subtitle, children }: { title: string; subtitle: string; children: (company: EngineerCompany) => ReactNode }) {
  const { t } = useI18n();
  const { companyId, company, state, retry } = useEngineerCompany();
  if (!companyId || state === 'notFound') return <NotFoundPage />;
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <PageHeader title={title} subtitle={subtitle} />
      {state === 'loading' && <Spinner label={t('common.loading')} />}
      {state === 'failed' && (
        <Alert tone="error" action={<Button variant="secondary" onClick={retry}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {state === 'ready' && company && <ScreenErrorBoundary>{children(company)}</ScreenErrorBoundary>}
    </div>
  );
}
