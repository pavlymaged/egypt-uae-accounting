import { Landmark, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import type { TranslationKey } from '../../../i18n/en';
import { useI18n } from '../../../i18n/I18nProvider';
import { todayIn } from '../../../lib/dates';
import { toUnits, trimZeros } from '../../../lib/decimal';
import { formatNumber, normalizeAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { CASH_COLUMNS, dbErrorText, fieldFromMessage, type BooksAccess, type CashAccount, type Project } from '../books';
import { compareText } from '../entries/entries';
import { FEE_MILESTONE_COLUMNS, FUNDS_COLUMNS, type FeeCharge, type FeeMilestone, type FeeMode, type FundsLine } from './feeCharges';

type ChargeField = 'project' | 'instalment' | 'date' | 'mode' | 'account' | 'rate' | 'notes';

const PREFIXES: [string, ChargeField][] = [
  ['Project', 'project'],
  ['Instalment', 'instalment'],
  ['Date:', 'date'],
  ['How the fee is paid:', 'mode'],
  ['Not enough of the client', 'mode'],
  ['Receiving account:', 'account'],
  ['Exchange rate:', 'rate'],
  ['Notes:', 'notes'],
];

const OTHER_STATE: Record<'pending' | 'charged', TranslationKey> = {
  pending: 'feeProgress.state.pending',
  charged: 'feeProgress.state.charged',
};

type Next = 'none' | 'submit' | 'post';

export interface ChargePreset {
  projectId: string;
  percent: string;
}

interface Props {
  open: boolean;
  access: BooksAccess;
  charge: FeeCharge | null;
  preset?: ChargePreset | null;
  projects: Project[];
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string) => void;
}

interface ProjectData {
  projectId: string;
  milestones: FeeMilestone[];
  funds: FundsLine[];
}

export function FeeChargeForm({ open, access, charge, preset, projects, onClose, onChanged, onDone }: Props) {
  const { t } = useI18n();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [percent, setPercent] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<FeeMode | ''>('');
  const [accountId, setAccountId] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState<CashAccount[] | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<Next | null>(null);
  const [error, setError] = useState<{ field: ChargeField | null; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntryId(charge?.entry_id ?? null);
    setProjectId(charge?.project_id ?? preset?.projectId ?? '');
    setPercent(charge?.milestone_percent ?? preset?.percent ?? '');
    setDate(charge?.entry_date ?? '');
    setMode(charge?.mode ?? '');
    setAccountId(charge?.account_id ?? '');
    setRate(charge && charge.currency !== access.currency ? charge.rate : '');
    setNotes(charge?.notes ?? '');
    setError(null);
    setBusy(null);
    setLoadFailed(false);
    setAccounts(null);
    let cancelled = false;
    Promise.all([
      supabase.from('cash_accounts').select(CASH_COLUMNS).eq('company_id', access.companyId).order('name'),
      charge ? Promise.resolve(null) : supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([cash, company]) => {
      if (cancelled) return;
      if (cash.error || !Array.isArray(cash.data) || company?.error) return setLoadFailed(true);
      setAccounts(cash.data as CashAccount[]);
      if (company) setDate(todayIn(company.data?.time_zone ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [open, charge, preset, access.companyId, access.currency]);

  const projectOptions = useMemo(
    () => projects.filter((p) => p.fee_method === 'fixed' && !p.is_operation && (p.is_active || p.id === charge?.project_id)),
    [projects, charge],
  );
  const project = projectOptions.find((p) => p.id === projectId) ?? null;

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setProjectData(null);
    Promise.all([
      supabase.from('project_fee_milestones').select(FEE_MILESTONE_COLUMNS).eq('project_id', project.id).order('sort_order'),
      supabase.from('project_funds').select(FUNDS_COLUMNS).eq('company_id', access.companyId).eq('project_code', project.code),
    ]).then(([ms, funds]) => {
      if (cancelled) return;
      if (ms.error || funds.error || !Array.isArray(ms.data) || !Array.isArray(funds.data)) return setLoadFailed(true);
      setProjectData({ projectId: project.id, milestones: ms.data as unknown as FeeMilestone[], funds: funds.data as unknown as FundsLine[] });
    });
    return () => {
      cancelled = true;
    };
  }, [open, project, access.companyId]);

  const ready = projectData && projectData.projectId === projectId ? projectData : null;
  const isCurrent = (m: FeeMilestone) => !!charge && charge.project_id === m.project_id && compareText(charge.milestone_percent, m.completion_percent) === 0;
  const selectable = (m: FeeMilestone) => m.state === 'chargeable' || isCurrent(m);
  const milestone = ready?.milestones.find((m) => compareText(m.completion_percent, percent || 'x') === 0 && selectable(m)) ?? null;
  const feeCurrency = milestone?.fee_currency ?? ready?.milestones[0]?.fee_currency ?? project?.fixed_fee_currency ?? null;
  const fundsHeld = feeCurrency ? ready?.funds.find((f) => f.currency === feeCurrency)?.funds_held ?? '0' : null;
  const enoughFunds = !!milestone && fundsHeld !== null && (compareText(fundsHeld, milestone.amount) ?? -1) >= 0;
  const accountOptions = (accounts ?? []).filter(
    (a) => a.kind !== 'custody' && a.currency === feeCurrency && (a.is_active || a.id === charge?.account_id),
  );
  const needsRate = !!feeCurrency && feeCurrency !== access.currency;
  const rateText = needsRate ? normalizeAmount(rate) : null;
  const secondStep: Next = access.selfService ? (access.canPost ? 'post' : 'none') : 'submit';

  useEffect(() => {
    if (mode === 'deducted' && milestone && fundsHeld !== null && !enoughFunds) setMode('');
  }, [mode, milestone, fundsHeld, enoughFunds]);

  function chooseProject(id: string) {
    setProjectId(id);
    setPercent('');
    setAccountId('');
  }

  async function save(next: Next) {
    if (rateText && toUnits(rateText, 20) === null) return setError({ field: 'rate', text: t('payments.err.number') });
    setBusy(next);
    setError(null);
    const { data, error: saveError } = await supabase.rpc('save_fee_charge', {
      p_company: access.companyId,
      p_entry: entryId,
      p_project: projectId || null,
      p_milestone_percent: milestone?.completion_percent ?? null,
      p_date: date || null,
      p_mode: mode || null,
      p_account: mode === 'direct' ? accountId || null : null,
      p_rate: rateText || null,
      p_notes: notes.trim(),
    });
    if (saveError || typeof data !== 'string') {
      setBusy(null);
      const text = dbErrorText(saveError, t);
      return setError({ field: fieldFromMessage(text, PREFIXES), text });
    }
    if (next === 'none') {
      setBusy(null);
      return onDone(t('feeCharges.savedDraft'));
    }
    const { error: nextError } = await supabase.rpc(next === 'submit' ? 'submit_entry' : 'post_entry', { p_entry: data });
    setBusy(null);
    if (nextError) {
      setEntryId(data);
      onChanged();
      return setError({ field: null, text: t('payments.nextRefused', { message: dbErrorText(nextError, t) }) });
    }
    onDone(t(next === 'submit' ? 'feeCharges.done.submitted' : 'feeCharges.done.posted'));
  }

  const errorFor = (field: ChargeField) => (error?.field === field ? error.text : null);
  const money = (value: string) => feeCurrency && <span dir="ltr" className="tabular-nums">{`${formatNumber(value, feeCurrency)} ${feeCurrency}`}</span>;

  return (
    <Modal
      open={open}
      wide
      title={entryId ? t('feeCharges.editTitle') : t('feeCharges.addTitle')}
      description={t('feeCharges.formHint')}
      submitLabel={busy === 'none' ? t('common.saving') : t('payments.saveDraft')}
      busy={busy !== null}
      onSubmit={() => save('none')}
      onClose={onClose}
      extraActions={
        secondStep !== 'none' && (
          <Button type="button" loading={busy === secondStep} disabled={busy !== null} onClick={() => save(secondStep)}>
            {secondStep === 'submit' ? t('payments.saveSubmit') : t('payments.savePost')}
          </Button>
        )
      }
    >
      {charge?.status === 'rejected' && charge.reject_comment && <Alert tone="warning">{t('feeCharges.returnedWith', { comment: charge.reject_comment })}</Alert>}
      {loadFailed && <Alert tone="error">{t('common.loadFailed')}</Alert>}
      {error && !error.field && <Alert tone="error">{error.text}</Alert>}

      <Field label={t('payments.field.project')} error={errorFor('project')} hint={projectOptions.length === 0 ? t('feeCharges.noProjects') : undefined}>
        {(id, d, invalid) => (
          <SelectInput id={id} aria-describedby={d} invalid={invalid} value={projectId} autoFocus={!preset} onChange={(e) => chooseProject(e.target.value)}>
            <option value="">{t('payments.chooseProject')}</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{`${p.code} - ${p.name}`}</option>
            ))}
          </SelectInput>
        )}
      </Field>

      {project && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink-800">{t('feeCharges.field.instalment')}</legend>
          {!ready && !loadFailed && <Spinner label={t('common.loading')} />}
          {ready && ready.milestones.length === 0 && <p className="text-sm text-ink-500">{t('feeCharges.noInstalments')}</p>}
          {ready?.milestones.map((m) => {
            const can = selectable(m);
            const checked = milestone === m;
            const reason =
              m.state === 'not_reached'
                ? t('feeCharges.notReached', { percent: trimZeros(m.current_completion ?? '0') })
                : !can && (m.state === 'pending' || m.state === 'charged')
                  ? t(OTHER_STATE[m.state])
                  : null;
            return (
              <label
                key={m.completion_percent}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  !can ? 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400' : checked ? 'cursor-pointer border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'cursor-pointer border-ink-200 hover:border-ink-300 hover:bg-ink-50/50'
                }`}
              >
                <input type="radio" name="instalment" className="h-4 w-4 accent-brand-700" disabled={!can} checked={checked} onChange={() => setPercent(m.completion_percent)} />
                <span className="flex-1">
                  <span className={`block text-sm font-medium ${can ? 'text-ink-900' : ''}`}>{t('feeCharges.atPercent', { percent: trimZeros(m.completion_percent) })}</span>
                  {reason && <span className="block text-xs">{reason}</span>}
                </span>
                <span dir="ltr" className={`text-sm font-semibold tabular-nums ${can ? 'text-ink-900' : ''}`}>{`${formatNumber(m.amount, m.fee_currency)} ${m.fee_currency}`}</span>
              </label>
            );
          })}
          {errorFor('instalment') && <p role="alert" className="text-sm text-red-700">{errorFor('instalment')}</p>}
        </fieldset>
      )}

      {milestone && feeCurrency && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('payments.field.amount')} hint={t('feeCharges.amountHint')}>
            {(id, d) => <TextInput id={id} aria-describedby={d} readOnly dir="ltr" value={`${formatNumber(milestone.amount, feeCurrency)} ${feeCurrency}`} />}
          </Field>
          <Field label={t('payments.field.date')} error={errorFor('date')}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
      )}

      {milestone && feeCurrency && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink-800">{t('feeCharges.field.mode')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              icon={<Wallet className="h-5 w-5" />}
              title={t('feeCharges.mode.deductOption')}
              checked={mode === 'deducted'}
              disabled={!enoughFunds}
              onSelect={() => setMode('deducted')}
            >
              <span className="block">{t('feeCharges.fundsHeld')} {fundsHeld !== null && money(fundsHeld)}</span>
              {!enoughFunds && <span className="mt-1 block font-medium text-amber-800">{t('feeCharges.notEnoughFunds')}</span>}
            </ModeCard>
            <ModeCard icon={<Landmark className="h-5 w-5" />} title={t('feeCharges.mode.directOption')} checked={mode === 'direct'} onSelect={() => setMode('direct')}>
              {t('feeCharges.mode.directHint')}
            </ModeCard>
          </div>
          {errorFor('mode') && <p role="alert" className="text-sm text-red-700">{errorFor('mode')}</p>}
        </fieldset>
      )}

      {milestone && mode === 'direct' && (
        <Field label={t('payments.field.account')} error={errorFor('account')} hint={accountOptions.length === 0 ? t('feeCharges.noAccounts', { currency: feeCurrency ?? '' }) : undefined}>
          {(id, d, invalid) => (
            <SelectInput id={id} aria-describedby={d} invalid={invalid} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{t('payments.chooseAccount')}</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{`${a.name} (${a.currency})`}</option>
              ))}
            </SelectInput>
          )}
        </Field>
      )}

      {milestone && needsRate && feeCurrency && (
        <Field label={t('payments.field.rate')} error={errorFor('rate')} hint={t('payments.rateHint', { currency: feeCurrency, base: access.currency })}>
          {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} />}
        </Field>
      )}

      <Field label={t('payments.field.notes')} optional error={errorFor('notes')}>
        {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </Modal>
  );
}

function ModeCard({ icon, title, checked, disabled, onSelect, children }: { icon: ReactNode; title: string; checked: boolean; disabled?: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <label
      className={`flex gap-3 rounded-xl border p-4 transition-colors ${
        disabled ? 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-500' : checked ? 'cursor-pointer border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'cursor-pointer border-ink-200 hover:border-ink-300 hover:bg-ink-50/50'
      }`}
    >
      <input type="radio" name="fee-mode" className="mt-1 h-4 w-4 accent-brand-700" disabled={disabled} checked={checked} onChange={onSelect} />
      <span className="space-y-1">
        <span className={`flex items-center gap-2 text-sm font-semibold ${disabled ? '' : 'text-ink-900'}`}>
          <span className={disabled ? 'text-ink-400' : 'text-brand-700'}>{icon}</span>
          {title}
        </span>
        <span className="block text-xs leading-relaxed">{children}</span>
      </span>
    </label>
  );
}
