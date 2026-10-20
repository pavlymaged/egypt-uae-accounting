import { Landmark, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { useI18n } from '../../i18n/I18nProvider';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onSignOut?: () => void;
}

export function AuthLayout({ title, subtitle, children, footer, onSignOut }: AuthLayoutProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -end-32 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl" />
        <Brand light />
        <div className="relative space-y-4">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight">{t('app.heroTitle')}</h2>
          <p className="max-w-sm text-sm leading-relaxed text-brand-100">{t('app.heroBody')}</p>
        </div>
        <p className="relative text-xs text-brand-200">{t('app.tagline')}</p>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <div className="lg:invisible">
            <Brand />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                <LogOut className="h-4 w-4 rtl:-scale-x-100" />
                {t('common.signOut')}
              </button>
            )}
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
          <div className="w-full max-w-sm animate-fade-in">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-500">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-ink-500">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="relative flex items-center gap-2.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${light ? 'bg-white/10 text-gold-300' : 'bg-brand-700 text-white'}`}>
        <Landmark className="h-5 w-5" />
      </span>
      <span className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>{t('app.name')}</span>
    </div>
  );
}
