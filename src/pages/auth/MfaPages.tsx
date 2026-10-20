import { Check, Copy, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { fromPath } from '../../auth/guards';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';
import { CodeForm } from './CodeForm';

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

async function startEnrollment(): Promise<Enrollment> {
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  for (const factor of factors.data.all) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Thalatha ${Date.now()}` });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export function MfaSetupPage({ hasVerifiedFactor, email }: { hasVerifiedFactor: boolean; email: string }) {
  const { t } = useI18n();
  const { refresh, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const begin = useCallback(() => {
    setError(null);
    startEnrollment()
      .then(setEnrollment)
      .catch((err: { message?: string }) =>
        setError(isNetworkError(err) ? t('common.networkError') : t('mfa.setupFailed', { msg: err.message ?? '' })),
      );
  }, [t]);

  useEffect(() => {
    if (hasVerifiedFactor || started.current) return;
    started.current = true;
    begin();
  }, [hasVerifiedFactor, begin]);

  if (hasVerifiedFactor) return <Navigate to="/mfa/verify" replace state={location.state} />;

  async function onCopy() {
    if (!enrollment) return;
    await navigator.clipboard.writeText(enrollment.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AuthLayout
      title={t('mfa.setupTitle')}
      subtitle={t('mfa.setupBody')}
      onSignOut={signOut}
      footer={<p dir="auto">{t('mfa.signedInAs', { email })}</p>}
    >
      {error && (
        <Alert tone="error" action={<Button variant="secondary" onClick={begin}>{t('common.retry')}</Button>}>
          {error}
        </Alert>
      )}
      {!error && !enrollment && <Spinner label={t('mfa.preparing')} />}
      {enrollment && (
        <ol className="space-y-6">
          <Step n={1} text={t('mfa.step1')}>
            <div className="mt-3 inline-flex rounded-xl border border-ink-200 bg-white p-3 shadow-sm">
              <img src={enrollment.qrCode} alt="QR" className="h-44 w-44" />
            </div>
          </Step>
          <Step n={2} text={t('mfa.step2')}>
            <div className="mt-2 flex items-center gap-2">
              <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg bg-ink-100 px-3 py-2 font-mono text-xs text-ink-800">
                {enrollment.secret}
              </code>
              <Button variant="secondary" onClick={onCopy} icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}>
                {copied ? t('mfa.copied') : t('mfa.copy')}
              </Button>
            </div>
          </Step>
          <Step n={3} text={t('mfa.step3')}>
            <div className="mt-3">
              <CodeForm
                factorId={enrollment.factorId}
                onVerified={async () => {
                  await refresh();
                  navigate(fromPath(location.state), { replace: true });
                }}
              />
            </div>
          </Step>
        </ol>
      )}
    </AuthLayout>
  );
}

function Step({ n, text, children }: { n: number; text: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
        {n}
      </span>
      <div className="min-w-0 flex-1 text-sm text-ink-700">
        {text}
        {children}
      </div>
    </li>
  );
}

export function MfaVerifyPage({ hasVerifiedFactor, email }: { hasVerifiedFactor: boolean; email: string }) {
  const { t } = useI18n();
  const { refresh, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasVerifiedFactor) return;
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError || !data.totp[0]) setError(t('identity.loadFailed'));
      else setFactorId(data.totp[0].id);
    });
  }, [hasVerifiedFactor, t]);

  if (!hasVerifiedFactor) return <Navigate to="/mfa/setup" replace state={location.state} />;

  return (
    <AuthLayout
      title={t('mfa.verifyTitle')}
      subtitle={t('mfa.verifyBody')}
      onSignOut={signOut}
      footer={<p dir="auto">{t('mfa.signedInAs', { email })}</p>}
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
        <ShieldCheck className="h-6 w-6" />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {!error && !factorId && <Spinner />}
      {factorId && (
        <CodeForm
          factorId={factorId}
          onVerified={async () => {
            await refresh();
            navigate(fromPath(location.state), { replace: true });
          }}
        />
      )}
    </AuthLayout>
  );
}
