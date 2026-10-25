import { Hash, ListTree, Percent } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/Feedback';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { FeeTableTab } from './FeeTableTab';
import { ItemCodesTab } from './ItemCodesTab';
import { OtherListsTab } from './OtherListsTab';

type RefTab = 'items' | 'fees' | 'other';

const TABS: RefTab[] = ['items', 'fees', 'other'];

const META: Record<RefTab, { label: TranslationKey; icon: ReactNode }> = {
  items: { label: 'ref.tab.items', icon: <Hash className="h-4 w-4" /> },
  fees: { label: 'ref.tab.fees', icon: <Percent className="h-4 w-4" /> },
  other: { label: 'ref.tab.other', icon: <ListTree className="h-4 w-4" /> },
};

export function ReferencePage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as RefTab | null;
  const tab: RefTab = requested && TABS.includes(requested) ? requested : 'items';

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('ref.title')} subtitle={t('ref.subtitle')} />
      <div role="tablist" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-ink-200 px-4 sm:mx-0 sm:px-0">
        {TABS.map((key) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setParams(key === 'items' ? {} : { tab: key }, { replace: true })}
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
      {tab === 'items' && <ItemCodesTab />}
      {tab === 'fees' && <FeeTableTab />}
      {tab === 'other' && <OtherListsTab />}
    </div>
  );
}
