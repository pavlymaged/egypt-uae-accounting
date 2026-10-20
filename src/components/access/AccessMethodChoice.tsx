import { KeyRound, Mail } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { AccessMethod } from '../../lib/invite';

const OPTIONS: { value: AccessMethod; icon: typeof KeyRound }[] = [
  { value: 'temporary_password', icon: KeyRound },
  { value: 'invite', icon: Mail },
];

export function AccessMethodChoice({ value, onChange }: { value: AccessMethod; onChange: (v: AccessMethod) => void }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-800">{t('access.question')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value: v, icon: Icon }) => {
          const selected = value === v;
          return (
            <label
              key={v}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${
                selected ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              <input type="radio" name="access-method" className="sr-only" checked={selected} onChange={() => onChange(v)} />
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-brand-700' : 'text-ink-400'}`} />
              <span>
                <span className="block text-sm font-medium text-ink-900">{t(`access.${v}`)}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{t(`access.${v}.help`)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
