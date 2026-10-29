import { ArrowLeft, ChevronDown, History, Lock, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime } from '../../lib/dates';
import { trimZeros } from '../../lib/decimal';
import { formatNumber } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import type { Currency } from '../../types';
import { ActiveBadge } from '../staff/StaffListPage';
import type { BooksAccess, Client, FeeRate, Milestone, Project } from './books';
import { ProjectFeeProgress } from './fees/ProjectFeeProgress';
import { ProjectFunds } from './fees/ProjectFunds';
import { feeSummary, readSnapshot, type SnapshotView } from './projectFormat';

interface Version {
  id: number;
  version: number;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  snapshot_text: string | null;
}

interface Props {
  project: Project;
  access: BooksAccess;
  milestones: Milestone[];
  clients: Client[];
  typeName: Map<string, string>;
  rates: FeeRate[];
  chargeHref: (entryId: string) => string;
  onBack: () => void;
  onEdit: () => void;
}

export function ProjectDetail({ project, access, milestones, clients, typeName, rates, chargeHref, onBack, onEdit }: Props) {
  const { t, lang } = useI18n();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const [fundsKey, setFundsKey] = useState(0);
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      const { data, error } = await supabase
        .from('project_versions')
        .select('id, version, reason, changed_by, changed_at, snapshot_text:snapshot::text')
        .eq('project_id', project.id)
        .order('version', { ascending: false });
      if (cancelled) return;
      if (error || !Array.isArray(data)) return setFailed(true);
      const rows = data as unknown as Version[];
      const ids = [...new Set(rows.map((r) => r.changed_by).filter((id): id is string => !!id))];
      const found = new Map<string, string>();
      if (ids.length) {
        const [staff, members] = await Promise.all([
          supabase.from('staff_members').select('user_id, full_name').in('user_id', ids),
          supabase.from('company_users').select('user_id, full_name').eq('company_id', access.companyId).in('user_id', ids),
        ]);
        for (const r of [...(members.data ?? []), ...(staff.data ?? [])] as { user_id: string; full_name: string }[]) found.set(r.user_id, r.full_name);
      }
      if (cancelled) return;
      setNames(found);
      setVersions(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, project.version, access.companyId, attempt]);

  const canEdit = access.canManageSetup && !project.is_operation;

  return (
    <div className="animate-fade-in space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('projects.backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="inline-flex items-center gap-1.5 font-mono text-sm font-medium text-brand-700">
              {project.is_operation && <Lock className="h-4 w-4 text-gold-700" />}
              {project.code}
            </span>
            <ActiveBadge active={project.is_active} />
            {project.is_operation && <Badge tone="gold">{t('projects.reserved')}</Badge>}
          </div>
          <h2 className="text-xl font-semibold text-ink-900">{project.name}</h2>
        </div>
        {canEdit && <Button icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>{t('common.edit')}</Button>}
      </div>

      <Card className="p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('projects.summary')}</h3>
        <TermsList
          terms={{ ...project, milestones: milestones.map((m) => ({ completion_percent: m.completion_percent, amount: m.amount })) }}
          clientName={clientName}
          typeName={typeName}
          rates={rates}
          extra={
            <>
              <Row label={t('projects.version')}><span className="tabular-nums">{project.version}</span></Row>
              <Row label={t('projects.updatedAt')}>{formatDateTime(project.updated_at, lang)}</Row>
            </>
          }
        />
      </Card>

      {project.fee_method === 'fixed' && !project.is_operation && (
        <ProjectFeeProgress project={project} access={access} chargeHref={chargeHref} onChanged={() => setFundsKey((k) => k + 1)} />
      )}
      <ProjectFunds companyId={access.companyId} projectCode={project.code} reloadKey={fundsKey} />

      <Card>
        <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4 sm:px-6">
          <History className="h-4 w-4 text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">{t('projects.history')}</h3>
        </div>
        {failed && (
          <div className="p-4">
            <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>{t('common.loadFailed')}</Alert>
          </div>
        )}
        {!failed && !versions && <Spinner label={t('common.loading')} />}
        {versions && versions.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-500 sm:px-6">{t('projects.noChanges')}</p>}
        {versions && versions.length > 0 && (
          <ul className="divide-y divide-ink-100">
            {versions.map((v) => {
              const expanded = openVersion === v.id;
              const snapshot = expanded ? readSnapshot(v.snapshot_text) : null;
              return (
                <li key={v.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <Badge tone="neutral">{t('projects.versionN', { n: v.version })}</Badge>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm text-ink-900">{v.reason || <span className="text-ink-400">-</span>}</p>
                      <p className="text-xs text-ink-500">
                        {formatDateTime(v.changed_at, lang)} · {(v.changed_by && names.get(v.changed_by)) || '-'}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => setOpenVersion(expanded ? null : v.id)} aria-expanded={expanded} icon={<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />}>
                      {t('common.view')}
                    </Button>
                  </div>
                  {expanded && (
                    <div className="mt-3 animate-fade-in rounded-xl border border-ink-200 bg-ink-50/50 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">{t('projects.valuesBefore', { n: v.version + 1 })}</p>
                      {snapshot ? <TermsList terms={snapshot} clientName={clientName} typeName={typeName} rates={rates} /> : <p className="text-sm text-ink-500">{t('projects.snapshotUnreadable')}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-900">{children}</dd>
    </div>
  );
}

function TermsList({ terms, clientName, typeName, rates, extra }: { terms: SnapshotView | (Project & { milestones: SnapshotView['milestones'] }); clientName: Map<string, string>; typeName: Map<string, string>; rates: FeeRate[]; extra?: ReactNode }) {
  const { t } = useI18n();
  const dash = <span className="text-ink-400">-</span>;
  const currency = terms.fixed_fee_currency;
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-ink-100">
        <Row label={t('projects.field.name')}>{terms.name || dash}</Row>
        <Row label={t('projects.field.client')}>{(terms.client_id && clientName.get(terms.client_id)) || dash}</Row>
        <Row label={t('projects.field.type')}>{(terms.project_type && typeName.get(terms.project_type)) || terms.project_type || dash}</Row>
        <Row label={t('projects.col.fee')}>{feeSummary(terms, terms.milestones.length, rates, t)}</Row>
        <Row label={t('books.col.status')}>{terms.is_active === null ? dash : <ActiveBadge active={terms.is_active} />}</Row>
        <Row label={t('projects.field.notes')}><span className="whitespace-pre-wrap">{terms.notes || dash}</span></Row>
        {extra}
      </dl>
      {terms.fee_method === 'fixed' && currency && terms.milestones.length > 0 && <InstalmentsTable rows={terms.milestones} currency={currency} />}
    </div>
  );
}

function InstalmentsTable({ rows, currency }: { rows: SnapshotView['milestones']; currency: Currency }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink-800">{t('projects.instalments')}</p>
      <div className="overflow-hidden rounded-xl border border-ink-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50/70 text-xs font-medium uppercase tracking-wide text-ink-500">
              <th className="px-4 py-2 text-start">#</th>
              <th className="px-4 py-2 text-start">{t('projects.ms.percent')}</th>
              <th className="px-4 py-2 text-end">{t('projects.ms.amount', { currency })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((m, i) => (
              <tr key={i}>
                <td className="px-4 py-2 tabular-nums text-ink-500">{i + 1}</td>
                <td className="px-4 py-2 tabular-nums"><span dir="ltr">{trimZeros(m.completion_percent)}%</span></td>
                <td className="px-4 py-2 text-end tabular-nums"><span dir="ltr">{formatNumber(m.amount, currency)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
