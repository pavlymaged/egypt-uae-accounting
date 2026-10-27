import { Ban, Coins, Percent, UserPlus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput, Toggle } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { fromUnits, toUnits, trimZeros } from '../../lib/decimal';
import { currencyDecimals, normalizeAmount } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, type Currency } from '../../types';
import { dbErrorText, fieldFromMessage, type BooksAccess, type Client, type FeeMethod, type FeeRate, type Milestone, type Project, type ProjectType } from './books';
import { ClientDialog } from './ClientDialog';
import { MilestonesEditor, newRow, type MilestoneRow } from './MilestonesEditor';
import { findRate, rateLabel } from './projectFormat';

type ProjectField = 'code' | 'name' | 'client' | 'type' | 'method' | 'markup' | 'fixed' | 'milestones' | 'notes' | 'reason';

const PREFIXES: [string, ProjectField][] = [
  ['Project code:', 'code'],
  ['Project name:', 'name'],
  ['Client:', 'client'],
  ['Project type:', 'type'],
  ['Fee method:', 'method'],
  ['Markup:', 'markup'],
  ['Fixed fee:', 'fixed'],
  ['Instalment', 'milestones'],
  ['Notes:', 'notes'],
  ['Reason:', 'reason'],
];

function amountForEditing(value: string | null, currency: Currency): string {
  if (!value) return '';
  const scale = currencyDecimals(currency);
  const units = toUnits(value, scale);
  return units === null ? value : fromUnits(units, scale);
}

interface Props {
  open: boolean;
  access: BooksAccess;
  project: Project | null;
  milestones: Milestone[];
  clients: Client[];
  types: ProjectType[];
  rates: FeeRate[];
  onClose: () => void;
  onSaved: () => void;
  onClientAdded: () => void;
}

export function ProjectForm({ open, access, project, milestones, clients, types, rates, onClose, onSaved, onClientAdded }: Props) {
  const { t } = useI18n();
  const editing = !!project;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [type, setType] = useState('');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<FeeMethod>('percent');
  const [markup, setMarkup] = useState('');
  const [total, setTotal] = useState('');
  const [currency, setCurrency] = useState<Currency>(access.currency);
  const [rows, setRows] = useState<MilestoneRow[]>([newRow('100')]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: ProjectField | null; text: string } | null>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [extraClient, setExtraClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setReason('');
    setExtraClient(null);
    if (project) {
      const cur = project.fixed_fee_currency ?? access.currency;
      setCode(project.code);
      setName(project.name);
      setClientId(project.client_id ?? '');
      setType(project.project_type ?? '');
      setActive(project.is_active);
      setNotes(project.notes ?? '');
      setMethod(project.fee_method);
      setMarkup(findRate(rates, project.fee_markup)?.markup ?? project.fee_markup ?? '');
      setTotal(amountForEditing(project.fixed_fee_total, cur));
      setCurrency(cur);
      const own = milestones.filter((m) => m.project_id === project.id).sort((a, b) => a.sort_order - b.sort_order);
      setRows(own.length ? own.map((m) => newRow(trimZeros(m.completion_percent), amountForEditing(m.amount, cur))) : [newRow('100')]);
      return;
    }
    setCode('');
    setName('');
    setClientId('');
    setType('');
    setActive(true);
    setNotes('');
    setMethod('percent');
    setMarkup('');
    setTotal('');
    setCurrency(access.currency);
    setRows([newRow('100')]);
    let cancelled = false;
    supabase.rpc('next_project_code', { p_company: access.companyId }).then(({ data }) => {
      if (!cancelled && typeof data === 'string') setCode((current) => current || data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, project, milestones, rates, access.companyId, access.currency]);

  const clientChoices = [...clients, ...(extraClient && !clients.some((c) => c.id === extraClient.id) ? [extraClient] : [])]
    .filter((c) => c.is_active || c.id === clientId)
    .sort((a, b) => a.name.localeCompare(b.name));

  async function save() {
    setBusy(true);
    setError(null);
    const fixed = method === 'fixed';
    const { data, error: rpcError } = await supabase.rpc('save_project', {
      p_company: access.companyId,
      p_id: project?.id ?? null,
      p_code: editing ? null : code.trim() || null,
      p_name: name.trim(),
      p_client: clientId || null,
      p_type: type || null,
      p_active: active,
      p_fee_method: method,
      p_fee_markup: method === 'percent' ? markup || null : null,
      p_fixed_total: fixed ? normalizeAmount(total) || null : null,
      p_fixed_currency: fixed ? currency : null,
      p_milestones: fixed ? rows.map((r) => ({ completion_percent: r.percent.trim(), amount: normalizeAmount(r.amount) })) : null,
      p_notes: notes.trim(),
      p_reason: editing ? reason.trim() : null,
    });
    setBusy(false);
    if (rpcError || typeof data !== 'string') {
      const text = dbErrorText(rpcError, t);
      return setError({ field: fieldFromMessage(text, PREFIXES), text });
    }
    onSaved();
  }

  const errorFor = (field: ProjectField) => (error?.field === field ? error.text : null);
  const sortedRates = [...rates].sort((a, b) => {
    const scale = 9;
    const x = toUnits(a.markup, scale) ?? BigInt(0);
    const y = toUnits(b.markup, scale) ?? BigInt(0);
    return x < y ? -1 : x > y ? 1 : 0;
  });

  return (
    <>
      <Modal
        open={open}
        wide
        title={project ? t('projects.editTitle', { code: project.code }) : t('projects.addTitle')}
        submitLabel={busy ? t('common.saving') : t('common.save')}
        busy={busy}
        onSubmit={save}
        onClose={() => !addingClient && onClose()}
      >
        {error && !error.field && <Alert tone="error">{error.text}</Alert>}

        <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          <Field label={t('projects.field.code')} error={errorFor('code')} hint={editing ? t('projects.codeFixed') : t('projects.codeHint')}>
            {(id, d, invalid) => (
              <TextInput id={id} aria-describedby={d} invalid={invalid} dir="ltr" value={code} readOnly={editing} disabled={editing} placeholder="2026-001" onChange={(e) => setCode(e.target.value)} className="font-mono" />
            )}
          </Field>
          <Field label={t('projects.field.name')} error={errorFor('name')}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Field label={t('projects.field.client')} error={errorFor('client')}>
              {(id, d, invalid) => (
                <SelectInput id={id} aria-describedby={d} invalid={invalid} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">{t('projects.chooseClient')}</option>
                  {clientChoices.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </SelectInput>
              )}
            </Field>
            {access.canManageClients && (
              <button type="button" onClick={() => setAddingClient(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline">
                <UserPlus className="h-3.5 w-3.5" />
                {t('projects.addClient')}
              </button>
            )}
          </div>
          <Field label={t('projects.field.type')} error={errorFor('type')}>
            {(id, d, invalid) => (
              <SelectInput id={id} aria-describedby={d} invalid={invalid} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">{t('projects.chooseType')}</option>
                {types.map((pt) => (
                  <option key={pt.code} value={pt.code}>{pt.name_en}</option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-medium text-ink-800">{t('projects.field.method')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <MethodCard value="percent" current={method} onPick={setMethod} icon={<Percent className="h-4 w-4" />} title={t('projects.method.percent')} text={t('projects.method.percentHint')} />
            <MethodCard value="fixed" current={method} onPick={setMethod} icon={<Coins className="h-4 w-4" />} title={t('projects.method.fixed')} text={t('projects.method.fixedHint')} />
            <MethodCard value="none" current={method} onPick={setMethod} icon={<Ban className="h-4 w-4" />} title={t('projects.method.none')} text={t('projects.method.noneHint')} />
          </div>
          {errorFor('method') && <p role="alert" className="text-xs font-medium text-red-700">{errorFor('method')}</p>}
        </fieldset>

        {method === 'percent' && (
          <Field label={t('projects.field.markup')} error={errorFor('markup')}>
            {(id, d, invalid) => (
              <SelectInput id={id} aria-describedby={d} invalid={invalid} value={markup} onChange={(e) => setMarkup(e.target.value)}>
                <option value="">{t('projects.chooseMarkup')}</option>
                {sortedRates.map((r) => (
                  <option key={r.markup} value={r.markup}>{rateLabel(r, t)}</option>
                ))}
              </SelectInput>
            )}
          </Field>
        )}

        {method === 'fixed' && (
          <div className="space-y-4 rounded-xl border border-ink-200 bg-ink-50/40 p-4">
            <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
              <Field label={t('projects.field.total')} error={errorFor('fixed')}>
                {(id, d, invalid) => (
                  <TextInput id={id} aria-describedby={d} invalid={invalid} dir="ltr" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="tabular-nums" />
                )}
              </Field>
              <Field label={t('projects.field.currency')}>
                {(id, d) => (
                  <SelectInput id={id} aria-describedby={d} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </SelectInput>
                )}
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-800">{t('projects.instalments')}</p>
              <MilestonesEditor rows={rows} onChange={setRows} total={total} currency={currency} error={errorFor('milestones')} />
            </div>
          </div>
        )}

        <Field label={t('projects.field.notes')} optional error={errorFor('notes')}>
          {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>

        <Toggle checked={active} onChange={setActive} label={t('common.active')} description={t('projects.activeHint')} />

        {editing && (
          <Field label={t('projects.field.reason')} error={errorFor('reason')} hint={t('projects.reasonHint')}>
            {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        )}
      </Modal>

      <ClientDialog
        open={addingClient}
        companyId={access.companyId}
        client={null}
        onClose={() => setAddingClient(false)}
        onSaved={(client) => {
          setAddingClient(false);
          setExtraClient(client);
          setClientId(client.id);
          onClientAdded();
        }}
      />
    </>
  );
}

function MethodCard({ value, current, onPick, icon, title, text }: { value: FeeMethod; current: FeeMethod; onPick: (m: FeeMethod) => void; icon: ReactNode; title: string; text: string }) {
  const selected = value === current;
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-all ${
        selected ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-ink-200 bg-white hover:border-ink-300'
      }`}
    >
      <span className="flex items-center gap-2">
        <input type="radio" name="fee-method" value={value} checked={selected} onChange={() => onPick(value)} className="sr-only" />
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${selected ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{icon}</span>
        <span className="text-sm font-medium text-ink-900">{title}</span>
      </span>
      <span className="text-xs leading-relaxed text-ink-500">{text}</span>
    </label>
  );
}
