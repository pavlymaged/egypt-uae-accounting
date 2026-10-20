import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-ink-900">{t('notFound.title')}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">{t('notFound.body')}</p>
      <Link
        to="/"
        className="mt-8 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
}
