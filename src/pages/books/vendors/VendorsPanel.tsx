import { FilePlus2, Pencil, Plus, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { SelectInput } from '../../../components/ui/Field';
import { ScreenErrorBoundary } from '../../../components/ui/ScreenErrorBoundary';
import { useI18n } from '../../../i18n/I18nProvider';
import { todayIn } from '../../../lib/dates';
import { matchesQuery } from '../../../lib/search';
import { supabase } from '../../../lib/supabase';
import type { BooksAccess } from '../books';
import { ListToolbar } from '../ListToolbar';
import { NewQuotationDialog } from '../quotations/NewQuotationDialog';
import { TotalsTriple } from '../quotations/QuotationParts';
import { EditVendorDialog } from './EditVendorDialog';
import { EngageVendorDialog } from './EngageVendorDialog';
import { ENGAGEMENT_COLUMNS, parseTotals, VENDOR_COLUMNS, type Engagement, type Profession, type ProjectOption, type Vendor } from './vendors';

interface VendorData {
  engagements: Engagement[];
  vendors: Vendor[];
  projects: ProjectOption[];
  professions: Profession[];
  today: string;
}

interface Group {
  key: string;
  code: string;
  name: string;
  professions: { key: string; code: number; name: string; rows: Engagement[] }[];
}

export function VendorsPanel({ access, quotationHref }: { access: BooksAccess; quotationHref: (id: string) => string }) {
  return (
    <ScreenErrorBoundary>
      <VendorsView access={access} quotationHref={quotationHref} />
    </ScreenErrorBoundary>
  );
}

function VendorsView({ access, quotationHref }: { access: BooksAccess; quotationHref: (id: string) => string }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState<VendorData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [profession, setProfession] = useState('');
  const [active, setActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [engaging, setEngaging] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('vendor_engagements_list').select(ENGAGEMENT_COLUMNS).eq('company_id', access.companyId).order('project_code').order('profession').order('serial'),
      supabase.from('vendors').select(VENDOR_COLUMNS).eq('company_id', access.companyId).order('name'),
      supabase.from('projects').select('id, code, name, is_operation, is_active').eq('company_id', access.companyId).order('code'),
      supabase.from('item_codes').select('code, name_en, name_ar, scope').eq('is_profession', true).eq('is_active', true).order('code'),
      supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([engagements, vendors, projects, professions, company]) => {
      if (cancelled) return;
      if (engagements.error || vendors.error || projects.error || professions.error || company.error) return setFailed(true);
      if (!Array.isArray(engagements.data) || !Array.isArray(vendors.data) || !Array.isArray(projects.data) || !Array.isArray(professions.data)) return setFailed(true);
      setData({
        engagements: engagements.data as unknown as Engagement[],
        vendors: vendors.data as Vendor[],
        projects: projects.data as ProjectOption[],
        professions: professions.data as Profession[],
        today: todayIn(company.data?.time_zone ?? null),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const vendorById = useMemo(() => new Map((data?.vendors ?? []).map((v) => [v.id, v])), [data]);
  const professionName = (e: Engagement) => (lang === 'ar' && e.profession_name_ar) || e.profession_name || String(e.profession);

  const projectChoices = useMemo(() => {
    const seen = new Map<string, string>();
    (data?.engagements ?? []).forEach((e) => seen.set(e.project_id, `${e.project_code} - ${e.project_name}`));
    return [...seen.entries()];
  }, [data]);

  const professionChoices = useMemo(() => {
    const seen = new Map<number, Engagement>();
    (data?.engagements ?? []).forEach((e) => seen.set(e.profession, e));
    return [...seen.values()].sort((a, b) => a.profession - b.profession);
  }, [data]);

  const groups = useMemo(() => {
    const rows = (data?.engagements ?? []).filter((e) => {
      const isActive = e.is_active && e.vendor_active;
      return (
        (!project || e.project_id === project) &&
        (!profession || String(e.profession) === profession) &&
        (active === 'all' || (active === 'active') === isActive) &&
        matchesQuery(query, [e.vendor_name, e.vendor_code, e.phone, e.email])
      );
    });
    const result: Group[] = [];
    rows.forEach((e) => {
      let group = result.find((g) => g.key === e.project_id);
      if (!group) {
        group = { key: e.project_id, code: e.project_code, name: e.project_name, professions: [] };
        result.push(group);
      }
      let prof = group.professions.find((p) => p.code === e.profession);
      if (!prof) {
        prof = { key: `${e.project_id}-${e.profession}`, code: e.profession, name: '', rows: [] };
        group.professions.push(prof);
      }
      prof.name = (lang === 'ar' && e.profession_name_ar) || e.profession_name || String(e.profession);
      prof.rows.push(e);
    });
    return result;
  }, [data, project, profession, active, query, lang]);

  const refresh = () => setAttempt((a) => a + 1);
  const done = (text: string) => {
    setNotice(text);
    setEngaging(false);
    setEditing(null);
    refresh();
  };

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={refresh}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data) return <Spinner label={t('common.loading')} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{t('vendors.intro')}</p>
        {access.canManageVendors && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEngaging(true)}>{t('vendors.engage')}</Button>
        )}
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('vendors.search')}>
          <SelectInput aria-label={t('vendors.field.project')} value={project} onChange={(e) => setProject(e.target.value)} className="w-52">
            <option value="">{t('vendors.allProjects')}</option>
            {projectChoices.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </SelectInput>
          <SelectInput aria-label={t('vendors.field.profession')} value={profession} onChange={(e) => setProfession(e.target.value)} className="w-52">
            <option value="">{t('vendors.allProfessions')}</option>
            {professionChoices.map((e) => (
              <option key={e.profession} value={String(e.profession)}>{`${e.profession} - ${professionName(e)}`}</option>
            ))}
          </SelectInput>
          <SelectInput aria-label={t('vendors.field.active')} value={active} onChange={(e) => setActive(e.target.value as typeof active)} className="w-36">
            <option value="all">{t('books.filter.all')}</option>
            <option value="active">{t('vendors.active')}</option>
            <option value="inactive">{t('vendors.inactive')}</option>
          </SelectInput>
        </ListToolbar>

        {groups.length === 0 ? (
          <EmptyState icon={<Store className="h-6 w-6" />} title={data.engagements.length === 0 ? t('vendors.empty') : t('books.noMatch')}>
            {data.engagements.length === 0 && <p className="text-sm text-ink-500">{access.canManageVendors ? t('vendors.emptyHint') : t('vendors.emptyViewer')}</p>}
          </EmptyState>
        ) : (
          <div className="divide-y divide-ink-100">
            {groups.map((g) => (
              <section key={g.key} className="p-4">
                <h3 className="flex flex-wrap items-baseline gap-2 text-base font-semibold text-ink-900">
                  <span dir="ltr" className="font-mono text-sm text-brand-700">{g.code}</span>
                  <span dir="auto">{g.name}</span>
                </h3>
                <div className="mt-3 space-y-4">
                  {g.professions.map((p) => (
                    <div key={p.key} className="rounded-xl border border-ink-200">
                      <p className="flex items-baseline gap-2 border-b border-ink-100 bg-ink-50/70 px-4 py-2 text-sm font-medium text-ink-700">
                        <span dir="ltr" className="font-mono text-xs text-ink-500">{p.code}</span>
                        <span dir="auto">{p.name}</span>
                      </p>
                      <ul className="divide-y divide-ink-100">
                        {p.rows.map((e) => (
                          <EngagementRow
                            key={e.engagement_id}
                            engagement={e}
                            canEdit={access.canManageVendors && vendorById.has(e.vendor_id)}
                            canQuote={access.canEditQuotations && e.is_active && e.vendor_active}
                            onEdit={() => setEditing(vendorById.get(e.vendor_id) ?? null)}
                            onQuote={() => setQuoteFor(e.engagement_id)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>

      <EngageVendorDialog
        open={engaging}
        access={access}
        vendors={data.vendors}
        projects={data.projects}
        professions={data.professions}
        onClose={() => setEngaging(false)}
        onDone={done}
      />
      <EditVendorDialog vendor={editing} access={access} onClose={() => setEditing(null)} onDone={done} />
      <NewQuotationDialog
        open={!!quoteFor}
        access={access}
        engagements={data.engagements}
        engagementId={quoteFor}
        today={data.today}
        onClose={() => setQuoteFor(null)}
        onCreated={(id) => navigate(quotationHref(id))}
      />
    </div>
  );
}

interface RowProps {
  engagement: Engagement;
  canEdit: boolean;
  canQuote: boolean;
  onEdit: () => void;
  onQuote: () => void;
}

function EngagementRow({ engagement: e, canEdit, canQuote, onEdit, onQuote }: RowProps) {
  const { t } = useI18n();
  const totals = parseTotals(e.quotation_totals);
  const isActive = e.is_active && e.vendor_active;
  return (
    <li className="grid gap-3 px-4 py-3 transition-colors hover:bg-brand-50/30 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-1">
        <p dir="ltr" className="font-mono text-xs font-semibold text-brand-700 rtl:text-end">{e.vendor_code}</p>
        <p className="flex flex-wrap items-center gap-2">
          <span dir="auto" className="font-medium text-ink-900">{e.vendor_name}</span>
          {!isActive && <Badge>{t('vendors.inactive')}</Badge>}
          {e.confirmed_different && <Badge tone="gold">{t('vendors.confirmedDifferent')}</Badge>}
        </p>
        {(e.phone || e.email) && <p dir="ltr" className="truncate text-xs text-ink-500 rtl:text-end">{[e.phone, e.email].filter(Boolean).join(' · ')}</p>}
        <p className="text-xs text-ink-500">{t('vendors.quotationCount', { n: e.quotation_count })}</p>
      </div>
      <div className="min-w-0 space-y-2">
        {totals.length === 0 ? (
          <p className="text-sm text-ink-500">{t('vendors.noApproved')}</p>
        ) : (
          totals.map((x) => <TotalsTriple key={x.currency} compact currency={x.currency} client={x.client_total} office={x.office_total} commission={x.commission} />)
        )}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {canEdit && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>{t('vendors.edit')}</Button>}
        {canQuote && <Button variant="secondary" icon={<FilePlus2 className="h-4 w-4" />} onClick={onQuote}>{t('quotations.add')}</Button>}
      </div>
    </li>
  );
}
