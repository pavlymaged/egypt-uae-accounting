import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../ui/Button';

export interface SharedCredentials {
  email: string;
  password: string;
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <div className="flex items-stretch gap-2">
        <div
          dir="ltr"
          className={`min-w-0 flex-1 select-all break-all rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-ink-900 ${mono ? 'font-mono text-base tracking-wider' : 'text-sm'}`}
        >
          {value}
        </div>
        <Button
          variant="secondary"
          onClick={() => void copy()}
          icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        >
          {copied ? t('share.copied') : t('share.copy')}
        </Button>
      </div>
      {failed && <p className="mt-1 text-xs text-red-600">{t('share.copyFailed')}</p>}
    </div>
  );
}

export function ShareCredentialsDialog({ credentials, onClose }: { credentials: SharedCredentials | null; onClose: () => void }) {
  const { t } = useI18n();
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!credentials) return;
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [credentials, onClose]);

  if (!credentials) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 id="share-title" className="text-base font-semibold text-ink-900">{t('share.title')}</h2>
        </div>
        <div className="mt-5 space-y-4">
          <CopyRow label={t('share.email')} value={credentials.email} />
          <CopyRow label={t('share.password')} value={credentials.password} mono />
          <div className="flex gap-3 rounded-lg border border-gold-200 bg-gold-50 p-3 text-sm text-ink-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <p>{t('share.warning')}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button ref={doneRef} onClick={onClose}>{t('share.done')}</Button>
        </div>
      </div>
    </div>
  );
}
