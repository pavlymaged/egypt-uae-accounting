import { Hash, Pencil, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStaff } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { SelectInput, TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { ActiveBadge } from '../staff/StaffListPage';
import { ItemCodeEditDialog } from './ItemCodeEditDialog';
import { ITEM_CODE_COLUMNS, type ItemCode } from './itemCodes';

type ScopeFilter = 'all' | 'site' | 'office';

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
        pressed ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
      }`}
    >
      {children}
    </button>
  );
}

function ArName({ value }: { value: string | null }) {
  return value ? <span dir="rtl" lang="ar">{value}</span> : <span className="text-ink-400">—</span>;
}

function ItemBadges({ item }: { item: ItemCode }) {
  const { t } = useI18n();
  return (
    <>
      <Badge tone={item.scope === 'site' ? 'sky' : 'neutral'}>{t(`ref.scope.${item.scope}`)}</Badge>
      {item.is_profession && <Badge tone="brand">{t('ref.badge.profession')}</Badge>}
      {item.is_asset && <Badge tone="gold">{t('ref.badge.asset')}</Badge>}
    </>
  );
}

export function ItemCodesTab() {
  const { t } = useI18n();
  const canEdit = useStaff()?.staff_role === 'super_admin';
  const [items, setItems] = useState<ItemCode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [professions, setProfessions] = useState(false);
  const [assets, setAssets] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [editing, setEditing] = useState<ItemCode | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('item_codes')
      .select(ITEM_CODE_COLUMNS)
      .order('code')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setItems((data ?? []) as ItemCode[]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (scope !== 'all' && i.scope !== scope) return false;
      if (professions && !i.is_profession) return false;
      if (assets && !i.is_asset) return false;
      if (inactive && i.is_active) return false;
      if (!q) return true;
      return String(i.code).includes(q) || i.name_en.toLowerCase().includes(q) || (i.name_ar ?? '').toLowerCase().includes(q);
    });
  }, [items, query, scope, professions, assets, inactive]);

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!items) return <Spinner label={t('common.loading')} />;

  const editButton = (item: ItemCode) =>
    canEdit && (
      <Button variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setSaved(null); setEditing(item); }}>
        {t('common.edit')}
      </Button>
    );

  return (
    <div className="space-y-4">
      {saved && <Alert tone="success">{saved}</Alert>}
      <ItemCodeEditDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setItems((prev) => prev?.map((i) => (i.code === next.code ? next : i)) ?? prev);
          setEditing(null);
          setSaved(t('ref.edit.saved', { code: next.code }));
        }}
      />

      <Card>
        <div className="space-y-3 border-b border-ink-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ref.items.search')} aria-label={t('ref.items.search')} className="ps-9" />
            </div>
            <SelectInput value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} aria-label={t('ref.col.scope')} className="sm:w-44">
              <option value="all">{t('ref.items.scopeAll')}</option>
              <option value="site">{t('ref.scope.site')}</option>
              <option value="office">{t('ref.scope.office')}</option>
            </SelectInput>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip pressed={professions} onClick={() => setProfessions((v) => !v)}>{t('ref.items.professionsOnly')}</Chip>
            <Chip pressed={assets} onClick={() => setAssets((v) => !v)}>{t('ref.items.assetsOnly')}</Chip>
            <Chip pressed={inactive} onClick={() => setInactive((v) => !v)}>{t('ref.items.inactiveOnly')}</Chip>
          </div>
          <p className="text-sm text-ink-500" aria-live="polite">{t('ref.items.showing', { shown: filtered.length, total: items.length })}</p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Hash className="h-6 w-6" />} title={t('ref.items.empty')} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3 text-start">{t('ref.col.code')}</th>
                    <th className="px-4 py-3 text-start">{t('ref.col.nameEn')}</th>
                    <th className="px-4 py-3 text-start">{t('ref.col.nameAr')}</th>
                    <th className="px-4 py-3 text-start">{t('ref.col.type')}</th>
                    <th className="px-4 py-3 text-start">{t('ref.col.state')}</th>
                    {canEdit && <th className="px-4 py-3"><span className="sr-only">{t('common.edit')}</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((i) => (
                    <tr key={i.code} className={`transition-colors hover:bg-brand-50/40 ${i.is_active ? '' : 'bg-ink-50/50'}`}>
                      <td className="px-4 py-3 font-semibold tabular-nums text-ink-900">{i.code}</td>
                      <td className="px-4 py-3 text-ink-900">{i.name_en}</td>
                      <td className="px-4 py-3 text-ink-700"><ArName value={i.name_ar} /></td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><ItemBadges item={i} /></div></td>
                      <td className="px-4 py-3"><ActiveBadge active={i.is_active} /></td>
                      {canEdit && <td className="px-4 py-3 text-end">{editButton(i)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 md:hidden">
              {filtered.map((i) => (
                <li key={i.code} className="flex items-start gap-3 p-4">
                  <span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-brand-50 px-2 text-sm font-semibold tabular-nums text-brand-800">{i.code}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-ink-900">{i.name_en}</p>
                    <p className="text-sm text-ink-600"><ArName value={i.name_ar} /></p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <ItemBadges item={i} />
                      <ActiveBadge active={i.is_active} />
                    </div>
                  </div>
                  {editButton(i)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
