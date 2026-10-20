import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useI18n } from '../../i18n/I18nProvider';
import { resetTemporaryPassword } from '../../lib/invite';
import { ShareCredentialsDialog, type SharedCredentials } from './ShareCredentialsDialog';

interface Props {
  userId: string;
  name: string;
  email: string;
}

export function ResetPasswordAction({ userId, name, email }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<SharedCredentials | null>(null);

  async function reset() {
    setBusy(true);
    const result = await resetTemporaryPassword(userId);
    setBusy(false);
    setConfirming(false);
    if (result.ok) {
      setError(null);
      setCredentials({ email, password: result.temporaryPassword });
      return;
    }
    if (result.code === 'not_found') setError(t('resetpw.notFound'));
    else if (result.code === 'network') setError(t('common.networkError'));
    else if (result.code === 'log_failed') setError(t('resetpw.logFailed'));
    else setError(t('resetpw.failed'));
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => { setError(null); setConfirming(true); }}>
        {t('resetpw.action')}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <ConfirmDialog
        open={confirming}
        title={t('resetpw.confirmTitle', { name })}
        confirmLabel={t('resetpw.confirm')}
        tone="danger"
        loading={busy}
        onConfirm={() => void reset()}
        onCancel={() => setConfirming(false)}
      >
        {t('resetpw.confirmBody')}
      </ConfirmDialog>
      <ShareCredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
