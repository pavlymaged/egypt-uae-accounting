import { Building2, LifeBuoy, Users, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import type { Company } from '../../types';

export type CompanyTab = 'details' | 'users' | 'staff' | 'support';

function tabsFor(company: Pick<Company, 'service_model'> | null): CompanyTab[] {
  if (!company) return ['details'];
  return company.service_model === 'self_service' ? ['details', 'users', 'staff', 'support'] : ['details', 'users', 'staff'];
}

export function useCompanyTab(company: Pick<Company, 'service_model'> | null): [CompanyTab, (tab: CompanyTab) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as CompanyTab | null;
  const tab = requested && tabsFor(company).includes(requested) ? requested : 'details';
  const setTab = (next: CompanyTab) => {
    setParams(next === 'details' ? {} : { tab: next }, { replace: true });
  };
  return [tab, setTab];
}

const META: Record<CompanyTab, { label: TranslationKey; icon: ReactNode }> = {
  details: { label: 'companyTabs.details', icon: <Building2 className="h-4 w-4" /> },
  users: { label: 'companyTabs.users', icon: <Users className="h-4 w-4" /> },
  staff: { label: 'companyTabs.staff', icon: <UsersRound className="h-4 w-4" /> },
  support: { label: 'companyTabs.support', icon: <LifeBuoy className="h-4 w-4" /> },
};

export function CompanyTabs({ company, tab, onChange }: { company: Pick<Company, 'service_model'>; tab: CompanyTab; onChange: (tab: CompanyTab) => void }) {
  const { t } = useI18n();
  return (
    <div role="tablist" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-ink-200 px-4 sm:mx-0 sm:px-0">
      {tabsFor(company).map((key) => {
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
