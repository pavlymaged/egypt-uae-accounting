import { LifeBuoy, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { formatTime } from '../lib/dates';
import { useSupportSession } from './SupportSessionProvider';

export function SupportBanner() {
  const { t, lang } = useI18n();
  const { active, close } = useSupportSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!active) return null;
  const edit = active.mode === 'edit';

  async function onClose() {
    if (!active) return;
    setBusy(true);
    setError(null);
    const res = await close(active.id);
    setBusy(false);
    if (res === 'ok') return;
    setError(res === 'network' ? t('common.networkError') : res === 'notSaved' ? t('common.notSaved') : t('common.saveFailed', res));
  }

  return (
    <div role="status" className={`sticky top-16 z-10 border-b px-4 py-2.5 sm:px-6 ${edit ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${edit ? 'bg-amber-500' : 'bg-sky-500'}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${edit ? 'bg-amber-600' : 'bg-sky-600'}`} />
        </span>
        <LifeBuoy className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-medium">
          {t('support.banner', {
            company: active.company?.name ?? '',
            mode: t(`support.mode.${active.mode}`),
            time: formatTime(active.expires_at, lang),
          })}
        </p>
        <button
          type="button"
          onClick={() => void onClose()}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
            edit ? 'border-amber-400 bg-white hover:bg-amber-100' : 'border-sky-300 bg-white hover:bg-sky-100'
          }`}
        >
          <X className="h-3.5 w-3.5" />
          {busy ? t('common.saving') : t('support.close')}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
