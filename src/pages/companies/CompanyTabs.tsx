import { BadgePercent, Building2, CalendarCheck, FolderKanban, Landmark, LifeBuoy, Receipt, UserRound, Users, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import type { Company } from '../../types';
import type { BookSection } from '../books/BookPanel';

export type CompanyTab = 'details' | 'users' | 'staff' | 'support' | 'projects' | 'clients' | 'cash' | 'payments' | 'fees' | 'months';

export const BOOK_TABS: CompanyTab[] = ['payments', 'fees', 'projects', 'clients', 'cash', 'months'];

export function adminCompanyTabs(company: Pick<Company, 'service_model'> | null, booksVisible: boolean): CompanyTab[] {
  if (!company) return ['details'];
  const base: CompanyTab[] = company.service_model === 'self_service' ? ['details', 'users', 'staff', 'support'] : ['details', 'users', 'staff'];
  return booksVisible ? [...base, ...BOOK_TABS] : base;
}

export function useCompanyTab(tabs: CompanyTab[]): [CompanyTab, (tab: CompanyTab) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as CompanyTab | null;
  const tab = requested && tabs.includes(requested) ? requested : tabs[0];
  const setTab = (next: CompanyTab) => {
    setParams(next === tabs[0] ? {} : { tab: next }, { replace: true });
  };
  return [tab, setTab];
}

export function isBookTab(tab: CompanyTab): tab is BookSection {
  return BOOK_TABS.includes(tab);
}

const META: Record<CompanyTab, { label: TranslationKey; icon: ReactNode }> = {
  details: { label: 'companyTabs.details', icon: <Building2 className="h-4 w-4" /> },
  users: { label: 'companyTabs.users', icon: <Users className="h-4 w-4" /> },
  staff: { label: 'companyTabs.staff', icon: <UsersRound className="h-4 w-4" /> },
  support: { label: 'companyTabs.support', icon: <LifeBuoy className="h-4 w-4" /> },
  projects: { label: 'companyTabs.projects', icon: <FolderKanban className="h-4 w-4" /> },
  clients: { label: 'companyTabs.clients', icon: <UserRound className="h-4 w-4" /> },
  cash: { label: 'companyTabs.cash', icon: <Landmark className="h-4 w-4" /> },
  payments: { label: 'companyTabs.payments', icon: <Receipt className="h-4 w-4" /> },
  fees: { label: 'companyTabs.fees', icon: <BadgePercent className="h-4 w-4" /> },
  months: { label: 'companyTabs.months', icon: <CalendarCheck className="h-4 w-4" /> },
};

export function CompanyTabs({ tabs, tab, onChange }: { tabs: CompanyTab[]; tab: CompanyTab; onChange: (tab: CompanyTab) => void }) {
  const { t } = useI18n();
  return (
    <div role="tablist" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-ink-200 px-4 sm:mx-0 sm:px-0">
      {tabs.map((key) => {
        const selected = key === tab;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800'
            }`}
          >
            {META[key].icon}
            {t(META[key].label)}
          </button>
        );
      })}
    </div>
  );
}
