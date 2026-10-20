import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field, TextInput } from '../../components/ui/Field';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { EMAIL_RE } from './LoginPage';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<TranslationKey | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = email.trim();
    if (!trimmed) return setFieldError('login.emailRequired');
    if (!EMAIL_RE.test(trimmed)) return setFieldError('login.emailInvalid');
    setFieldError(null);
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      if (isNetworkError(error)) setFormError(t('common.networkError'));
      else if (error.status === 429) setFormError(t('login.tooMany'));
      else setFormError(t('common.saveFailed', { msg: error.message }));
      return;
    }
    setSentTo(trimmed);
  }

  const back = (
    <Link to="/login" className="inline-flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800 hover:underline">
      <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
      {t('forgot.back')}
    </Link>
  );

  return (
    <AuthLayout title={t('forgot.title')} subtitle={t('forgot.body')} footer={back}>
      {sentTo ? (
        <Alert tone="success">{t('forgot.sent', { email: sentTo })}</Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label={t('login.email')} error={fieldError ? t(fieldError) : null}>
            {(id, describedBy, invalid) => (
              <TextInput
                id={id}
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
                autoFocus
              />
            )}
          </Field>
          <Button type="submit" full loading={sending}>
            {sending ? t('forgot.sending') : t('forgot.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
