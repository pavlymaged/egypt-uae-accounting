import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Spinner } from '../../components/ui/Feedback';
import { Field, PasswordInput } from '../../components/ui/Field';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { CodeForm } from './CodeForm';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const { status, session } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: TranslationKey; confirm?: TranslationKey }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [codeFactorId, setCodeFactorId] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      setSaving(false);
      setDone(true);
      return;
    }
    if (error.code === 'insufficient_aal' || /aal2/i.test(error.message)) {
      const factors = await supabase.auth.mfa.listFactors();
      setSaving(false);
      if (!factors.error && factors.data.totp[0]) {
        setCodeFactorId(factors.data.totp[0].id);
        return;
      }
    }
    setSaving(false);
    if (error.code === 'same_password') setErrors({ password: 'reset.samePassword' });
    else if (error.code === 'weak_password') setErrors({ password: 'reset.weak' });
    else if (isNetworkError(error)) setFormError(t('common.networkError'));
    else setFormError(t('common.saveFailed', { msg: error.message }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (password.length < 8) next.password = 'reset.passwordShort';
    if (confirm !== password) next.confirm = 'reset.passwordMismatch';
    setErrors(next);
    if (next.password || next.confirm) return;
    await save();
  }

  if (status === 'loading') {
    return (
      <AuthLayout title={t('reset.title')}>
        <Spinner label={t('reset.checking')} />
      </AuthLayout>
    );
  }

  if (!session && !done) {
    return (
      <AuthLayout title={t('reset.title')}>
        <Alert tone="error">{t('reset.invalidLink')}</Alert>
        <Link to="/forgot-password" className="mt-6 inline-flex font-medium text-brand-700 hover:underline">
          {t('reset.requestNew')}
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title={t('reset.title')}>
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
            <p className="font-medium">{t('reset.done')}</p>
          </div>
          <Button full onClick={() => navigate(session ? '/' : '/login', { replace: true })}>
            {t('reset.continue')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (codeFactorId) {
    return (
      <AuthLayout title={t('mfa.verifyTitle')} subtitle={t('reset.needsCode')}>
        <CodeForm
          factorId={codeFactorId}
          submitLabel={t('reset.submit')}
          onVerified={async () => {
            setCodeFactorId(null);
            await save();
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('reset.title')} subtitle={t('reset.body')}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label={t('reset.newPassword')} error={errors.password ? t(errors.password) : null}>
          {(id, describedBy, invalid) => (
            <PasswordInput
              id={id}
              dir="ltr"
              autoComplete="new-password"
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
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Button type="submit" full loading={saving}>
          {t('reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
