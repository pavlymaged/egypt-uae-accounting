import { ChevronRight, FolderKanban, Lock, Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { SelectInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { ActiveBadge } from '../staff/StaffListPage';
import {
  CLIENT_COLUMNS,
  MILESTONE_COLUMNS,
  PROJECT_COLUMNS,
  type BooksAccess,
  type Client,
  type FeeRate,
  type Milestone,
  type Project,
  type ProjectType,
} from './books';
import { ListToolbar } from './ListToolbar';
import { ProjectDetail } from './ProjectDetail';
import { ProjectForm } from './ProjectForm';
import { feeSummary } from './projectFormat';

interface ProjectData {
  projects: Project[];
  milestones: Milestone[];
  types: ProjectType[];
  rates: FeeRate[];
}

type StatusFilter = 'active' | 'inactive' | 'all';

export function ProjectsPanel({ access, chargeHref }: { access: BooksAccess; chargeHref: (entryId: string) => string }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProjectData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [form, setForm] = useState<{ project: Project | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    const { data: rows, error } = await supabase.from('clients').select(CLIENT_COLUMNS).eq('company_id', access.companyId).order('name');
    if (error || !Array.isArray(rows)) return false;
    setClients(rows as Client[]);
    return true;
  }, [access.companyId]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('projects').select(PROJECT_COLUMNS).eq('company_id', access.companyId).order('code'),
      supabase.from('project_milestones').select(MILESTONE_COLUMNS).eq('company_id', access.companyId).order('sort_order'),
      supabase.from('project_types').select('code, name_en').order('name_en'),
      supabase.from('fee_table').select('markup:markup::text, on_income:on_income::text'),
      loadClients(),
    ]).then(([projects, milestones, types, rates, clientsOk]) => {
      if (cancelled) return;
      const lists = [projects.data, milestones.data, types.data, rates.data];
      if (projects.error || milestones.error || types.error || rates.error || !clientsOk || !lists.every(Array.isArray)) return setFailed(true);
      setData({
        projects: projects.data as unknown as Project[],
        milestones: milestones.data as unknown as Milestone[],
        types: types.data as ProjectType[],
        rates: rates.data as unknown as FeeRate[],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt, loadClients]);

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const typeName = useMemo(() => new Map((data?.types ?? []).map((pt) => [pt.code, pt.name_en])), [data]);
  const instalmentCount = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.milestones ?? []).forEach((m) => counts.set(m.project_id, (counts.get(m.project_id) ?? 0) + 1));
    return counts;
  }, [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.projects ?? [])
      .filter((p) => status === 'all' || (status === 'active') === p.is_active)
      .filter((p) => !q || [p.code, p.name, clientName.get(p.client_id ?? '') ?? ''].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.is_operation) - Number(a.is_operation) || a.code.localeCompare(b.code));
  }, [data, query, status, clientName]);

  const openId = params.get('project');
  const openProject = data?.projects.find((p) => p.id === openId) ?? null;

  const showProject = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('project', id);
        else next.delete('project');
        return next;
      },
      { replace: !id },
    );

  function onSaved() {
    setNotice(form?.project ? t('projects.saved') : t('projects.added'));
    setForm(null);
    setAttempt((a) => a + 1);
  }

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data) return <Spinner label={t('common.loading')} />;

  const formEl = (
    <ProjectForm
      open={!!form}
      access={access}
      project={form?.project ?? null}
      milestones={data.milestones}
      clients={clients}
      types={data.types}
      rates={data.rates}
      onClose={() => setForm(null)}
      onSaved={onSaved}
      onClientAdded={() => void loadClients()}
    />
  );

  if (openId) {
    return (
      <>
        {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}
        {openProject ? (
          <ProjectDetail
            project={openProject}
            access={access}
            milestones={data.milestones.filter((m) => m.project_id === openProject.id)}
            clients={clients}
            typeName={typeName}
            rates={data.rates}
            chargeHref={chargeHref}
            onBack={() => showProject(null)}
            onEdit={() => setForm({ project: openProject })}
          />
        ) : (
          <EmptyState icon={<FolderKanban className="h-6 w-6" />} title={t('books.notFound')}>
            <Button variant="secondary" onClick={() => showProject(null)}>{t('projects.backToList')}</Button>
          </EmptyState>
        )}
        {formEl}
      </>
    );
  }

  const canEdit = (p: Project) => access.canManageSetup && !p.is_operation;
  const fee = (p: Project) => (p.is_operation ? t('projects.reserved') : feeSummary(p, instalmentCount.get(p.id) ?? 0, data.rates, t));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">{t('projects.intro')}</p>
        {access.canManageSetup && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ project: null })}>{t('projects.add')}</Button>
        )}
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('projects.search')}>
          <SelectInput aria-label={t('books.col.status')} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-40">
            <option value="active">{t('books.filter.active')}</option>
            <option value="inactive">{t('books.filter.inactive')}</option>
            <option value="all">{t('books.filter.all')}</option>
          </SelectInput>
        </ListToolbar>
        {visible.length === 0 ? (
          <EmptyState icon={<FolderKanban className="h-6 w-6" />} title={t('books.noMatch')} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3 text-start">{t('projects.field.code')}</th>
                    <th className="px-4 py-3 text-start">{t('projects.field.name')}</th>
                    <th className="px-4 py-3 text-start">{t('projects.field.client')}</th>
                    <th className="px-4 py-3 text-start">{t('projects.field.type')}</th>
                    <th className="px-4 py-3 text-start">{t('projects.col.fee')}</th>
                    <th className="px-4 py-3 text-start">{t('books.col.status')}</th>
                    <th className="px-4 py-3"><span className="sr-only">{t('common.view')}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {visible.map((p) => (
                    <tr key={p.id} onClick={() => showProject(p.id)} className={`cursor-pointer transition-colors hover:bg-brand-50/40 ${p.is_operation ? 'bg-gold-50/40' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span dir="ltr" className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-brand-700">
                          {p.is_operation && <Lock className="h-3.5 w-3.5 text-gold-700" aria-label={t('projects.locked')} />}
                          {p.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                      <td className="px-4 py-3 text-ink-700">{clientName.get(p.client_id ?? '') ?? <span className="text-ink-400">-</span>}</td>
                      <td className="px-4 py-3 text-ink-700">{typeName.get(p.project_type ?? '') ?? <span className="text-ink-400">-</span>}</td>
                      <td className="px-4 py-3 text-ink-700">{p.is_operation ? <Badge tone="gold">{fee(p)}</Badge> : <span dir="auto">{fee(p)}</span>}</td>
                      <td className="px-4 py-3"><ActiveBadge active={p.is_active} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                        {canEdit(p) && (
                          <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setForm({ project: p })}>{t('common.edit')}</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">
              {visible.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => showProject(p.id)} className={`flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-brand-50/40 ${p.is_operation ? 'bg-gold-50/40' : ''}`}>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {p.is_operation && <Lock className="h-3.5 w-3.5 text-gold-700" />}
                        <span dir="ltr" className="font-mono text-xs font-medium text-ink-500">{p.code}</span>
                        <ActiveBadge active={p.is_active} />
                      </div>
                      <p className="font-medium text-ink-900">{p.name}</p>
                      {p.client_id && <p className="text-sm text-ink-600">{clientName.get(p.client_id)}</p>}
                      <p className="text-xs text-ink-500">{fee(p)}</p>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {formEl}
    </div>
  );
}
