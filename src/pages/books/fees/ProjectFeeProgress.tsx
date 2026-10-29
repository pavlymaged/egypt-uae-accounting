import { ArrowUpRight, BadgePercent, Gauge, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Badge, Card, Spinner } from '../../../components/ui/Feedback';
import type { TranslationKey } from '../../../i18n/en';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDateTime } from '../../../lib/dates';
import { trimZeros } from '../../../lib/decimal';
import { formatNumber } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import type { Currency } from '../../../types';
import type { BooksAccess, Project } from '../books';
import { loadPeopleNames } from '../entries/EntryTrail';
import { CompletionDialog } from './CompletionDialog';
import { FeeChargeForm, type ChargePreset } from './FeeChargeForm';
import { FEE_MILESTONE_COLUMNS, FEE_SUMMARY_COLUMNS, percentWidth, type FeeMilestone, type FeeSummary, type MilestoneState } from './feeCharges';

interface Completion {
  id: number;
  percent: string;
  note: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

interface Loaded {
  summary: FeeSummary | null;
  milestones: FeeMilestone[];
  history: Completion[];
  names: Map<string, string>;
}

const STATE: Record<MilestoneState, { label: TranslationKey; tone: 'neutral' | 'sky' | 'warning' | 'success' }> = {
  not_reached: { label: 'feeProgress.state.notReached', tone: 'neutral' },
  chargeable: { label: 'feeProgress.state.chargeable', tone: 'warning' },
  pending: { label: 'feeProgress.state.pending', tone: 'sky' },
  charged: { label: 'feeProgress.state.charged', tone: 'success' },
};

interface Props {
  project: Project;
  access: BooksAccess;
  chargeHref: (entryId: string) => string;
  onChanged: () => void;
}

export function ProjectFeeProgress({ project, access, chargeHref, onChanged }: Props) {
  const { t, lang } = useI18n();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [preset, setPreset] = useState<ChargePreset | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      const [summary, milestones, history] = await Promise.all([
        supabase.from('project_fee_summary').select(FEE_SUMMARY_COLUMNS).eq('project_id', project.id).maybeSingle(),
        supabase.from('project_fee_milestones').select(FEE_MILESTONE_COLUMNS).eq('project_id', project.id).order('sort_order'),
        supabase
          .from('project_completion')
          .select('id, percent:percent::text, note, recorded_by, recorded_at')
          .eq('project_id', project.id)
          .order('recorded_at', { ascending: false })
          .order('id', { ascending: false }),
      ]);
      if (cancelled) return;
      if (summary.error || milestones.error || history.error || !Array.isArray(milestones.data) || !Array.isArray(history.data)) return setFailed(true);
      const rows = history.data as unknown as Completion[];
      const names = await loadPeopleNames(access.companyId, rows.map((r) => r.recorded_by));
      if (cancelled) return;
      setLoaded({ summary: (summary.data as unknown as FeeSummary | null) ?? null, milestones: milestones.data as unknown as FeeMilestone[], history: rows, names });
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, project.version, access.companyId, attempt]);

  const refresh = () => {
    setAttempt((a) => a + 1);
    onChanged();
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-brand-700" />
        <h3 className="text-sm font-semibold text-ink-900">{t('feeProgress.title')}</h3>
      </div>
      {access.canRecord && project.is_active && (
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setRecording(true)}>{t('feeProgress.record')}</Button>
      )}
    </div>
  );

  if (failed) {
    return (
      <Card>
        {header}
        <div className="p-4">
          <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>{t('common.loadFailed')}</Alert>
        </div>
      </Card>
    );
  }
  if (!loaded) return <Card>{header}<Spinner label={t('common.loading')} /></Card>;

  const { summary, milestones, history } = loaded;
  const currency: Currency | null = summary?.fee_currency ?? milestones[0]?.fee_currency ?? project.fixed_fee_currency;
  const current = summary?.current_completion ?? history[0]?.percent ?? null;
  const money = (value: string | undefined) => (currency && value !== undefined ? <span dir="ltr" className="tabular-nums">{`${formatNumber(value, currency)} ${currency}`}</span> : '-');

  return (
    <Card>
      {header}
      <div className="space-y-6 p-5 sm:p-6">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{t('feeProgress.explain')}</p>
        {notice && <Alert tone="success">{notice}</Alert>}

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink-700">{t('feeProgress.completion')}</span>
            <span dir="ltr" className="text-2xl font-semibold tabular-nums text-ink-900">{current === null ? '0%' : `${trimZeros(current)}%`}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${current === null ? '0' : trimZeros(current)}%`}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-[width] duration-700 ease-out rtl:bg-gradient-to-l" style={{ width: percentWidth(current) }} />
          </div>
          {current === null && <p className="mt-2 text-xs text-ink-500">{t('feeProgress.noCompletion')}</p>}
        </div>

        {summary ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('feeProgress.total')}>{money(summary.total_fee)}</Stat>
            <Stat label={t('feeProgress.charged')} tone="text-emerald-700">{money(summary.charged_amount)}</Stat>
            <Stat label={t('feeProgress.pending')} tone="text-sky-700">{money(summary.pending_amount)}</Stat>
            <Stat label={t('feeProgress.remaining')}>{money(summary.remaining_amount)}</Stat>
          </dl>
        ) : (
          <p className="text-sm text-ink-500">{t('feeProgress.noSummary')}</p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">{t('projects.instalments')}</p>
          {milestones.length === 0 ? (
            <p className="text-sm text-ink-500">{t('feeCharges.noInstalments')}</p>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200">
              {milestones.map((m) => {
                const state = STATE[m.state] ?? STATE.not_reached;
                return (
                  <li key={m.completion_percent} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${m.state === 'chargeable' ? 'bg-amber-50/50' : ''}`}>
                    <span dir="ltr" className="w-16 text-sm font-semibold tabular-nums text-ink-900">{`${trimZeros(m.completion_percent)}%`}</span>
                    <span dir="ltr" className="flex-1 text-sm tabular-nums text-ink-800">{`${formatNumber(m.amount, m.fee_currency)} ${m.fee_currency}`}</span>
                    <Badge tone={state.tone}>{t(state.label)}</Badge>
                    {m.state === 'chargeable' && access.canRecord && (
                      <Button icon={<BadgePercent className="h-4 w-4" />} onClick={() => setPreset({ projectId: project.id, percent: m.completion_percent })}>
                        {t('feeProgress.charge')}
                      </Button>
                    )}
                    {(m.state === 'pending' || m.state === 'charged') && m.charge_entry_id && (
                      <Link to={chargeHref(m.charge_entry_id)} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                        {t('feeProgress.viewCharge')}
                        <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">{t('feeProgress.history')}</p>
          {history.length === 0 ? (
            <p className="text-sm text-ink-500">{t('feeProgress.noHistory')}</p>
          ) : (
            <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                  <span dir="ltr" className="w-16 text-sm font-semibold tabular-nums text-ink-900">{`${trimZeros(h.percent)}%`}</span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs text-ink-500">{formatDateTime(h.recorded_at, lang)} · {(h.recorded_by && loaded.names.get(h.recorded_by)) || '-'}</p>
                    {h.note && <p dir="auto" className="whitespace-pre-line text-sm text-ink-700">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CompletionDialog
        open={recording}
        companyId={access.companyId}
        projectId={project.id}
        current={current}
        onClose={() => setRecording(false)}
        onDone={() => {
          setRecording(false);
          setNotice(t('feeProgress.recorded'));
          refresh();
        }}
      />
      <FeeChargeForm
        open={!!preset}
        access={access}
        charge={null}
        preset={preset}
        projects={[project]}
        onClose={() => setPreset(null)}
        onChanged={refresh}
        onDone={(text) => {
          setPreset(null);
          setNotice(text);
          refresh();
        }}
      />
    </Card>
  );
}

function Stat({ label, tone = 'text-ink-900', children }: { label: string; tone?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/40 px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className={`mt-1 text-base font-semibold ${tone}`}>{children}</dd>
    </div>
  );
}
