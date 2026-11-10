import { CheckCircle2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Spinner } from '../../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { toUnits } from '../../../lib/decimal';
import { matchesQuery } from '../../../lib/search';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, type BooksAccess } from '../books';
import { ItemCodePicker } from '../expenses/ItemCodePicker';
import type { Profession, ProjectOption, Vendor } from './vendors';

interface Props {
  open: boolean;
  access: BooksAccess;
  vendors: Vendor[];
  projects: ProjectOption[];
  professions: Profession[];
  onClose: () => void;
  onDone: (text: string) => void;
}

interface CheckRow {
  error: string | null;
  similar_name: string | null;
  similarity: string | null;
  vendor_code: string | null;
}

type Check = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; row: CheckRow } | { kind: 'failed'; message: string };

const percent = (text: string | null) => {
  const units = toUnits(text ?? '0', 4);
  return units === null ? '' : String(Math.round(Number(units) / 100));
};

export function EngageVendorDialog({ open, access, vendors, projects, professions, onClose, onDone }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [vendorId, setVendorId] = useState('');
  const [vendorQuery, setVendorQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [profession, setProfession] = useState('');
  const [different, setDifferent] = useState(false);
  const [check, setCheck] = useState<Check>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeVendors = useMemo(() => vendors.filter((v) => v.is_active), [vendors]);
  const vendorMatches = useMemo(
    () => activeVendors.filter((v) => matchesQuery(vendorQuery, [v.name, v.phone, v.email])).slice(0, 50),
    [activeVendors, vendorQuery],
  );
  const projectOptions = useMemo(() => projects.filter((p) => !p.is_operation && p.is_active), [projects]);

  useEffect(() => {
    if (!open) return;
    setMode(activeVendors.length ? 'existing' : 'new');
    setVendorId('');
    setVendorQuery('');
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setProjectId('');
    setProfession('');
    setDifferent(false);
    setCheck({ kind: 'idle' });
    setError(null);
  }, [open, activeVendors.length]);

  const checkKey = JSON.stringify({ mode, vendorId, name: name.trim(), projectId, profession });

  useEffect(() => {
    const input = JSON.parse(checkKey) as { mode: string; vendorId: string; name: string; projectId: string; profession: string };
    const ready = !!input.projectId && !!input.profession && (input.mode === 'existing' ? !!input.vendorId : !!input.name);
    if (!open || !ready) {
      setCheck({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCheck({ kind: 'loading' });
      const { data, error: rpcError } = await supabase
        .rpc('check_vendor_engagement', {
          p_company: access.companyId,
          p_vendor: input.mode === 'existing' ? input.vendorId : null,
          p_name: input.mode === 'new' ? input.name : null,
          p_project: input.projectId,
          p_profession: Number(input.profession),
        })
        .select('error, similar_name, similarity:similarity::text, vendor_code');
      if (cancelled) return;
      const row = Array.isArray(data) ? (data[0] as unknown as CheckRow | undefined) : undefined;
      if (rpcError || !row) return setCheck({ kind: 'failed', message: dbErrorText(rpcError, t) });
      setCheck({ kind: 'ready', row });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, checkKey, access.companyId, t]);

  const similar = check.kind === 'ready' && !check.row.error ? check.row.similar_name : null;

  useEffect(() => {
    setDifferent(false);
  }, [similar]);

  async function submit() {
    setError(null);
    if (mode === 'existing' && !vendorId) return setError(t('vendors.chooseVendor'));
    if (mode === 'new' && !name.trim()) return setError(t('vendors.nameRequired'));
    if (!projectId) return setError(t('vendors.chooseProject'));
    if (!profession) return setError(t('vendors.chooseProfession'));
    if (similar && !different) return setError(t('vendors.confirmDifferentNeeded'));
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('save_vendor_engagement', {
      p_company: access.companyId,
      p_vendor: mode === 'existing' ? vendorId : null,
      p_name: mode === 'new' ? name.trim() : null,
      p_phone: mode === 'new' ? phone.trim() || null : null,
      p_email: mode === 'new' ? email.trim() || null : null,
      p_notes: mode === 'new' ? notes.trim() || null : null,
      p_project: projectId,
      p_profession: Number(profession),
      p_confirm_different: !!similar && different,
    });
    setBusy(false);
    if (rpcError) return setError(dbErrorText(rpcError, t));
    onDone(t('vendors.done.engaged'));
  }

  const modeButton = (value: 'existing' | 'new', label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === value ? 'bg-white text-brand-800 shadow-sm ring-1 ring-ink-200' : 'text-ink-600 hover:text-ink-900'}`}
    >
      {label}
    </button>
  );

  return (
    <Modal open={open} title={t('vendors.engageTitle')} description={t('vendors.engageIntro')} submitLabel={t('vendors.engageSave')} busy={busy} wide onSubmit={submit} onClose={onClose}>
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <div role="radiogroup" aria-label={t('vendors.field.vendor')} className="flex gap-1 rounded-xl bg-ink-100 p-1">
          {modeButton('existing', t('vendors.mode.existing'))}
          {modeButton('new', t('vendors.mode.new'))}
        </div>

        {mode === 'existing' ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink-800">{t('vendors.field.vendor')}</p>
            <div className="rounded-xl border border-ink-200">
              <div className="relative border-b border-ink-100">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={vendorQuery}
                  onChange={(e) => setVendorQuery(e.target.value)}
                  placeholder={t('vendors.vendorSearch')}
                  aria-label={t('vendors.vendorSearch')}
                  className="w-full rounded-t-xl bg-transparent py-2.5 pe-3 ps-9 text-sm focus:outline-none"
                />
              </div>
              <ul role="listbox" aria-label={t('vendors.field.vendor')} className="max-h-48 overflow-y-auto py-1">
                {vendorMatches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-ink-500">{activeVendors.length ? t('books.noMatch') : t('vendors.noVendorsYet')}</li>
                ) : (
                  vendorMatches.map((v) => (
                    <li key={v.id} role="option" aria-selected={v.id === vendorId}>
                      <button
                        type="button"
                        onClick={() => setVendorId(v.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-start text-sm transition-colors ${v.id === vendorId ? 'bg-brand-50 text-brand-900' : 'hover:bg-ink-50'}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="block truncate font-medium">{v.name}</span>
                          {(v.phone || v.email) && <span dir="ltr" className="block truncate text-xs text-ink-500 rtl:text-end">{[v.phone, v.email].filter(Boolean).join(' · ')}</span>}
                        </span>
                        {v.id === vendorId && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-700" />}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t('vendors.field.name')}>
                {(id, d) => <TextInput id={id} aria-describedby={d} dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />}
              </Field>
            </div>
            <Field label={t('vendors.field.phone')} optional>
              {(id) => <TextInput id={id} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />}
            </Field>
            <Field label={t('vendors.field.email')} optional>
              {(id) => <TextInput id={id} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />}
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('vendors.field.notes')} optional>
                {(id) => <TextArea id={id} dir="auto" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
              </Field>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('vendors.field.project')} hint={projectOptions.length ? undefined : t('vendors.noProjects')}>
            {(id, d) => (
              <SelectInput id={id} aria-describedby={d} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">{t('vendors.chooseProject')}</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{`${p.code} - ${p.name}`}</option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field label={t('vendors.field.profession')}>
            {() => <ItemCodePicker value={profession} items={professions} onChange={setProfession} aria-label={t('vendors.field.profession')} />}
          </Field>
        </div>

        {check.kind === 'loading' && <Spinner label={t('vendors.checking')} />}
        {check.kind === 'failed' && <Alert tone="error">{check.message}</Alert>}
        {check.kind === 'ready' && check.row.error && <Alert tone="error">{check.row.error}</Alert>}
        {check.kind === 'ready' && !check.row.error && check.row.vendor_code && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
            {t('vendors.codeWillBe')} <span dir="ltr" className="font-mono font-semibold">{check.row.vendor_code}</span>
          </div>
        )}
        {similar && check.kind === 'ready' && (
          <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{t('vendors.similarWarning', { name: similar, percent: percent(check.row.similarity) })}</p>
            <label className="flex cursor-pointer items-center gap-3 font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={different} onChange={(e) => setDifferent(e.target.checked)} />
              {t('vendors.confirmDifferent')}
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
