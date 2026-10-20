import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

interface CodeFormProps {
  factorId: string;
  onVerified: () => Promise<void> | void;
  submitLabel?: string;
}

export function CodeForm({ factorId, onVerified, submitLabel }: CodeFormProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t('mfa.codeFormat'));
      return;
    }
    setError(null);
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setVerifying(false);
      setCode('');
      setError(isNetworkError(verifyError) ? t('common.networkError') : t('mfa.codeWrong'));
      return;
    }
    await onVerified();
    setVerifying(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label={t('mfa.code')} error={error}>
        {(id, describedBy, invalid) => (
          <TextInput
            id={id}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-describedby={describedBy}
            invalid={invalid}
            autoFocus
            className="h-12 text-center font-mono text-xl tracking-[0.5em] placeholder:tracking-[0.5em]"
          />
        )}
      </Field>
      <Button type="submit" full loading={verifying}>
        {verifying ? t('mfa.verifying') : (submitLabel ?? t('mfa.verify'))}
      </Button>
    </form>
  );
}
