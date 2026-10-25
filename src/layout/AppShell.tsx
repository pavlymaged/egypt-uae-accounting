import { BookOpen, Briefcase, Building2, History, Home, LayoutDashboard, LifeBuoy, LogOut, Menu, Repeat, ScrollText, UserCog, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { LanguageSwitch } from '../components/LanguageSwitch';
import type { TranslationKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import { Brand } from '../pages/auth/AuthLayout';
import { SupportBanner } from '../support/SupportBanner';
import { SupportSessionProvider } from '../support/SupportSessionProvider';
import { isPlatformAdmin } from '../types';

interface NavItem {
  to: string;
  label: TranslationKey;
  icon: ReactNode;
}

function useNavItems(): NavItem[] {
  const { identity, activeCompany } = useSession();
  if (identity?.kind === 'staff') {
    if (isPlatformAdmin(identity.staff.staff_role)) {
      return [
        { to: '/', label: 'nav.dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
        { to: '/companies', label: 'nav.companies', icon: <Building2 className="h-5 w-5" /> },
        { to: '/staff', label: 'nav.staff', icon: <Users className="h-5 w-5" /> },
        { to: '/support-sessions', label: 'nav.support', icon: <LifeBuoy className="h-5 w-5" /> },
        { to: '/reference', label: 'nav.reference', icon: <BookOpen className="h-5 w-5" /> },
        { to: '/audit', label: 'nav.audit', icon: <ScrollText className="h-5 w-5" /> },
      ];
    }
    return [
      { to: '/', label: 'nav.dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { to: '/my-companies', label: 'nav.myCompanies', icon: <Briefcase className="h-5 w-5" /> },
      { to: '/reference', label: 'nav.reference', icon: <BookOpen className="h-5 w-5" /> },
    ];
  }
  const home: NavItem = { to: '/', label: 'nav.home', icon: <Home className="h-5 w-5" /> };
  if (activeCompany?.role === 'owner') {
    return [
      home,
      { to: '/users', label: 'nav.users', icon: <UserCog className="h-5 w-5" /> },
      { to: '/activity', label: 'nav.activity', icon: <History className="h-5 w-5" /> },
    ];
  }
  return [home];
}

function useBadge(): { primary: string; secondary: string } | null {
  const { identity, activeCompany } = useSession();
  const { t } = useI18n();
  if (identity?.kind === 'staff') return { primary: t('app.name'), secondary: t(`role.${identity.staff.staff_role}`) };
  if (activeCompany) return { primary: activeCompany.company.name, secondary: t(`role.${activeCompany.role}`) };
  return null;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const { identity, session, signOut } = useSession();
  const items = useNavItems();
  const multiCompany = identity?.kind === 'company' && identity.memberships.length > 1;
  const name = identity?.kind === 'staff' ? identity.staff.full_name : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600'}>{item.icon}</span>
                {t(item.label)}
              </>
            )}
          </NavLink>
        ))}
        {multiCompany && (
          <Link
            to="/choose-company"
            onClick={onNavigate}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <Repeat className="h-5 w-5 text-ink-400 group-hover:text-ink-600" />
            {t('picker.switch')}
          </Link>
        )}
      </nav>
      <div className="border-t border-ink-200 p-3">
        <div className="px-3 pb-3">
          {name && <p className="truncate text-sm font-medium text-ink-900">{name}</p>}
          <p dir="ltr" className="truncate text-xs text-ink-500 rtl:text-end">{session?.user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-5 w-5 rtl:-scale-x-100" />
          {t('common.signOut')}
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const badge = useBadge();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <SupportSessionProvider>
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-ink-200 bg-white lg:block">
        <Sidebar />
      </aside>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-ink-950/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.openMenu')}
          className={`absolute inset-y-0 start-0 w-72 max-w-[85%] bg-white shadow-2xl transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
          {open && <Sidebar onNavigate={() => setOpen(false)} />}
        </div>
      </div>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('nav.openMenu')}
            className="-ms-2 flex h-10 w-10 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          {badge && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink-900">{badge.primary}</span>
              <span className="shrink-0 rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800 ring-1 ring-inset ring-gold-200">
                {badge.secondary}
              </span>
            </div>
          )}
          <div className="ms-auto">
            <LanguageSwitch />
          </div>
        </header>
        <SupportBanner />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
    </SupportSessionProvider>
  );
}
