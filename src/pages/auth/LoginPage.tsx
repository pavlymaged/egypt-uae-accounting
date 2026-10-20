import { Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field, PasswordInput, TextInput } from '../../components/ui/Field';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { t } = useI18n();
  const { notice, clearNotice } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: TranslationKey; password?: TranslationKey }>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearNotice();
    setFormError(null);
    const trimmed = email.trim();
    const next: typeof errors = {};
    if (!trimmed) next.email = 'login.emailRequired';
    else if (!EMAIL_RE.test(trimmed)) next.email = 'login.emailInvalid';
    if (!password) next.password = 'login.passwordRequired';
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    if (error) {
      setSubmitting(false);
      if (isNetworkError(error)) setFormError('common.networkError');
      else if (error.status === 429) setFormError('login.tooMany');
      else setFormError('login.invalidCredentials');
    }
  }

  return (
    <AuthLayout
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={<p className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-400" />{t('login.noSignup')}</p>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {notice && (
          <Alert tone={notice === 'identity.disabled' ? 'error' : 'warning'}>
            <p className="font-medium">{t(notice)}</p>
            {notice === 'identity.disabled' && <p>{t('identity.disabledBody')}</p>}
          </Alert>
        )}
        {formError && <Alert tone="error">{t(formError)}</Alert>}
        <Field label={t('login.email')} error={errors.email ? t(errors.email) : null}>
          {(id, describedBy, invalid) => (
            <TextInput
              id={id}
              type="email"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              autoFocus
            />
          )}
        </Field>
        <Field label={t('login.password')} error={errors.password ? t(errors.password) : null}>
          {(id, describedBy, invalid) => (
            <PasswordInput
              id={id}
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline">
            {t('login.forgot')}
          </Link>
        </div>
        <Button type="submit" full loading={submitting}>
          {submitting ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
