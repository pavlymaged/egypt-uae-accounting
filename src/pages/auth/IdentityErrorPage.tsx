import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { AuthLayout } from './AuthLayout';

export function IdentityErrorPage() {
  const { t } = useI18n();
  const { refresh, signOut } = useSession();
  return (
    <AuthLayout title={t('app.name')} onSignOut={signOut}>
      <div className="space-y-6">
        <Alert tone="error">{t('identity.loadFailed')}</Alert>
        <Button full onClick={() => void refresh()}>
          {t('common.retry')}
        </Button>
      </div>
    </AuthLayout>
  );
}
