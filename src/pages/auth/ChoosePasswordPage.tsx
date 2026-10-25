import { useState, type FormEvent } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field, PasswordInput } from '../../components/ui/Field';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { changeInitialPassword } from '../../lib/invite';
import { AuthLayout } from './AuthLayout';

const MIN_LENGTH = 12;
const MAX_LENGTH = 72;

export function ChoosePasswordPage() {
  const { t } = useI18n();
  const { session, signOut, finishPasswordChange } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: TranslationKey; confirm?: TranslationKey }>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (password.length < MIN_LENGTH) next.password = 'reset.passwordShort';
    else if (password.length > MAX_LENGTH) next.password = 'firstpw.tooLong';
    if (confirm !== password) next.confirm = 'reset.passwordMismatch';
    setErrors(next);
    if (next.password || next.confirm) return;

    const token = session?.access_token;
    if (!token) {
      setFormError('firstpw.failed');
      return;
    }

    setSaving(true);
    let changed = false;
    try {
      const result = await changeInitialPassword(password, token);
      if (result.ok) {
        changed = true;
        setLeaving(true);
        setPassword('');
        setConfirm('');
      } else if (result.code === 'weak_password') setErrors({ password: 'reset.weak' });
      else if (result.code === 'same_password') setErrors({ password: 'firstpw.same' });
      else if (result.code === 'invalid_password') setErrors({ password: 'reset.passwordShort' });
      else if (result.code === 'timeout') setFormError('firstpw.timeout');
      else if (result.code === 'network') setFormError('common.networkError');
      else setFormError('firstpw.failed');
    } catch {
      setFormError('firstpw.failed');
    } finally {
      setSaving(false);
    }
    if (changed) await finishPasswordChange();
  }

  return (
    <AuthLayout title={t('firstpw.title')} subtitle={t('firstpw.body')}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="error">{t(formError)}</Alert>}
        <p dir="ltr" className="truncate text-sm text-ink-500 rtl:text-end">{session?.user.email}</p>
        <Field label={t('reset.newPassword')} error={errors.password ? t(errors.password) : null}>
          {(id, describedBy, invalid) => (
            <PasswordInput
              id={id}
              dir="ltr"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              autoFocus
            />
          )}
        </Field>
        <Field label={t('reset.confirmPassword')} error={errors.confirm ? t(errors.confirm) : null}>
          {(id, describedBy, invalid) => (
            <PasswordInput
              id={id}
              dir="ltr"
              autoComplete="new-password"
              maxLength={MAX_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Button type="submit" full loading={saving || leaving}>
          {t('firstpw.submit')}
        </Button>
        <button type="button" onClick={() => void signOut()} className="w-full text-center text-sm font-medium text-ink-500 hover:text-ink-800">
          {t('firstpw.signOut')}
        </button>
      </form>
    </AuthLayout>
  );
}
