import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { t, toggleLang, lang } = useI18n();
  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={t('lang.label')}
      title={t('lang.label')}
      lang={lang === 'en' ? 'ar' : 'en'}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 ${className}`}
    >
      <Languages className="h-4 w-4 text-ink-500" />
      {t('lang.switch')}
    </button>
  );
}
