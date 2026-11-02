import { HardHat, Info, Plus, UserPlus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ShareCredentialsDialog, type SharedCredentials } from '../../components/access/ShareCredentialsDialog';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Field, SelectInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ScreenErrorBoundary } from '../../components/ui/ScreenErrorBoundary';
import { useSession, useStaff } from '../../auth/SessionProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { isPlatformAdmin, type Company } from '../../types';
import { dbErrorText, PROJECT_COLUMNS, type BooksAccess, type Project } from '../books/books';
import { CompanyUserDialog } from '../companies/CompanyUserDialog';
import { ENGINEER_COLUMNS, type EngineerOverview, type EngineerProjectRef } from './claims';
import { CustodyBalance } from './ClaimParts';

type CompanyInfo = Pick<Company, 'id' | 'service_model' | 'status'>;
type Notice = { tone: 'success' | 'error'; text: string };

interface Loaded {
  engineers: EngineerOverview[];
  projects: Project[];
  company: CompanyInfo;
}

export function EngineersPanel({ access }: { access: BooksAccess }) {
  return (
    <ScreenErrorBoundary>
      <EngineersScreen access={access} />
    </ScreenErrorBoundary>
  );
}

function EngineersScreen({ access }: { access: BooksAccess }) {
  const { t } = useI18n();
  const staff = useStaff();
  const { identity, activeCompany } = useSession();
  const asAdmin = !!staff && isPlatformAdmin(staff.staff_role);
  const isOwner = identity?.kind === 'company' && activeCompany?.company_id === access.companyId && activeCompany.role === 'owner';
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [assignFor, setAssignFor] = useState<EngineerOverview | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [credentials, setCredentials] = useState<SharedCredentials | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('engineers_overview').select(ENGINEER_COLUMNS).eq('company_id', access.companyId).order('full_name'),
      supabase.from('projects').select(PROJECT_COLUMNS).eq('company_id', access.companyId).order('code'),
      supabase.from('companies').select('id, service_model, status').eq('id', access.companyId).maybeSingle(),
    ]).then(([engineers, projects, company]) => {
      if (cancelled) return;
      if (engineers.error || !Array.isArray(engineers.data) || projects.error || !Array.isArray(projects.data) || company.error || !company.data) return setFailed(true);
      setData({ engineers: engineers.data as unknown as EngineerOverview[], projects: projects.data as unknown as Project[], company: company.data as CompanyInfo });
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const assignable = useMemo(() => (data?.projects ?? []).filter((p) => p.is_active && !p.is_operation && !!p.client_id), [data]);
  const refresh = () => setAttempt((a) => a + 1);

  const remove = async (e: EngineerOverview, p: EngineerProjectRef) => {
    const key = `${e.engineer_user_id}:${p.project_id}`;
    setRemoving(key);
    setNotice(null);
    const { error } = await supabase.rpc('set_engineer_project', { p_company: access.companyId, p_engineer: e.engineer_user_id, p_project: p.project_id, p_assigned: false });
    setRemoving(null);
    setNotice(error ? { tone: 'error', text: dbErrorText(error, t) } : { tone: 'success', text: t('engineers.removed') });
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

  const canAddUser = (asAdmin || isOwner) && data.company.status !== 'closed';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-3xl gap-2.5 rounded-lg bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p>{t('engineers.note')}</p>
        </div>
        {canAddUser && (
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => { setNotice(null); setAdding(true); }}>
            {t('engineers.add')}
          </Button>
        )}
      </div>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {data.engineers.length === 0 ? (
        <Card>
          <EmptyState icon={<HardHat className="h-6 w-6" />} title={t('engineers.empty')} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.engineers.map((e) => {
            const projects = Array.isArray(e.projects) ? e.projects : [];
            return (
              <Card key={e.engineer_user_id} className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900">{e.full_name}</p>
                      <Badge tone={e.is_active ? 'success' : 'neutral'}>{e.is_active ? t('engineers.active') : t('engineers.inactive')}</Badge>
                    </div>
                    {e.email && <p dir="ltr" className="truncate text-xs text-ink-500 rtl:text-end">{e.email}</p>}
                  </div>
                </div>

                <div className="rounded-lg border border-ink-100 bg-ink-50/60 px-4 py-3">
                  {e.account_id ? (
                    <>
                      <p className="mb-1 text-xs font-medium text-ink-500">{e.account_name}</p>
                      <CustodyBalance balance={e.custody_balance} currency={e.currency ?? access.currency} view="company" />
                    </>
                  ) : (
                    <p className="text-sm text-ink-500">{t('engineers.noAccount')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t('engineers.projects')}</p>
                  {projects.length === 0 ? (
                    <p className="text-sm text-ink-500">{t('engineers.noProjects')}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {projects.map((p) => {
                        const key = `${e.engineer_user_id}:${p.project_id}`;
                        return (
                          <li key={p.project_id} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pe-1 ps-3 text-sm text-brand-800">
                            <span dir="ltr" className="font-mono text-xs">{p.code}</span>
                            <span className="max-w-[12rem] truncate">{p.name}</span>
                            {access.canManageSetup && (
                              <button
                                type="button"
                                disabled={removing !== null}
                                onClick={() => remove(e, p)}
                                aria-label={t('engineers.remove', { project: p.name })}
                                title={t('engineers.remove', { project: p.name })}
                                className="ms-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
                              >
                                {removing === key ? <Spinner /> : <X className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {access.canManageSetup && (
                  <div className="mt-auto">
                    <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => { setNotice(null); setAssignFor(e); }}>
                      {t('engineers.assign')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AssignDialog
        engineer={assignFor}
        companyId={access.companyId}
        projects={assignable}
        onClose={() => setAssignFor(null)}
        onAssigned={() => {
          setAssignFor(null);
          setNotice({ tone: 'success', text: t('engineers.assigned') });
          refresh();
        }}
      />

      {canAddUser && (
        <CompanyUserDialog
          open={adding}
          companyId={data.company.id}
          serviceModel={data.company.service_model}
          canChooseOwner={asAdmin}
          editing={null}
          presetRole="site_engineer"
          onClose={() => setAdding(false)}
          onInvited={(email) => {
            setAdding(false);
            setNotice({ tone: 'success', text: t('invite.sent', { email }) });
            refresh();
          }}
          onCreated={(creds) => {
            setAdding(false);
            setNotice({ tone: 'success', text: t('invite.created', { email: creds.email }) });
            setCredentials(creds);
            refresh();
          }}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
      <ShareCredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

function AssignDialog({ engineer, companyId, projects, onClose, onAssigned }: { engineer: EngineerOverview | null; companyId: string; projects: Project[]; onClose: () => void; onAssigned: () => void }) {
  const { t } = useI18n();
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProjectId('');
    setError(null);
  }, [engineer]);

  const taken = new Set((Array.isArray(engineer?.projects) ? engineer.projects : []).map((p) => p.project_id));
  const options = projects.filter((p) => !taken.has(p.id));

  const submit = async () => {
    if (!engineer) return;
    if (!projectId) return setError(t('claims.required'));
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.rpc('set_engineer_project', { p_company: companyId, p_engineer: engineer.engineer_user_id, p_project: projectId, p_assigned: true });
    setBusy(false);
    if (failure) return setError(dbErrorText(failure, t));
    onAssigned();
  };

  return (
    <Modal
      open={engineer !== null}
      title={t('engineers.assignTitle', { name: engineer?.full_name ?? '' })}
      description={t('engineers.assignHint')}
      submitLabel={t('engineers.assign')}
      busy={busy}
      onSubmit={submit}
      onClose={() => !busy && onClose()}
    >
      {options.length === 0 ? (
        <p className="text-sm text-ink-600">{t('engineers.noneLeft')}</p>
      ) : (
        <Field label={t('claims.field.project')} error={error}>
          {(id, d, invalid) => (
            <SelectInput id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-describedby={d} invalid={invalid}>
              <option value="">{t('claims.choose')}</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>{`${p.code} · ${p.name}`}</option>
              ))}
            </SelectInput>
          )}
        </Field>
      )}
      {options.length === 0 && error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
