import { FolderX, Send } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import { todayIn } from '../../../lib/dates';
import { currencyDecimals, isValidAmount, normalizeAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { dbErrorText } from '../../books/books';
import type { CostCentre, ItemCode } from '../../books/expenses/expenses';
import { ItemCodePicker } from '../../books/expenses/ItemCodePicker';
import { CLAIM_COLUMNS, type MyProject, type SiteClaim } from '../claims';
import { EngineerScreen } from './EngineerScreen';
import type { EngineerCompany } from './useEngineerCompany';

interface Draft {
  project: string;
  date: string;
  amount: string;
  category: string;
  item: string;
  description: string;
  receipt: string;
}

type FieldKey = keyof Draft;

interface Loaded {
  projects: MyProject[];
  centres: CostCentre[];
  items: ItemCode[];
  claim: SiteClaim | null;
}

export function ClaimFormPage() {
  const { t } = useI18n();
  const { id } = useParams();
  return (
    <EngineerScreen title={id ? t('claims.editTitle') : t('nav.newClaim')} subtitle={id ? t('claims.editSubtitle') : t('claims.newSubtitle')}>
      {(c) => <ClaimForm key={id ?? 'new'} company={c} claimId={id ?? null} />}
    </EngineerScreen>
  );
}

function ClaimForm({ company, claimId }: { company: EngineerCompany; claimId: string | null }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.rpc('my_projects').select('company_id, project_id, project_code, project_name'),
      supabase.from('cost_centres').select('code, name_en, name_ar').order('code'),
      supabase.from('item_codes').select('code, name_en, name_ar, scope').eq('scope', 'site').eq('is_active', true).order('code'),
      claimId ? supabase.from('site_claims_list').select(CLAIM_COLUMNS).eq('claim_id', claimId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]).then(([projects, centres, items, claim]) => {
      if (cancelled) return;
      if (projects.error || centres.error || items.error || claim.error || !Array.isArray(projects.data) || !Array.isArray(centres.data) || !Array.isArray(items.data)) return setFailed(true);
      const mine = (projects.data as unknown as MyProject[]).filter((p) => p.company_id === company.companyId);
      const existing = (claim.data as unknown as SiteClaim | null) ?? null;
      setData({ projects: mine, centres: centres.data as CostCentre[], items: items.data as ItemCode[], claim: existing });
      setDraft(
        existing
          ? {
              project: existing.project_id,
              date: existing.claim_date,
              amount: existing.amount ?? '',
              category: existing.category ?? '',
              item: existing.item_code === null ? '' : String(existing.item_code),
              description: existing.description ?? '',
              receipt: existing.receipt_link ?? '',
            }
          : { project: mine.length === 1 ? mine[0].project_id : '', date: todayIn(company.timeZone), amount: '', category: '', item: '', description: '', receipt: '' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [claimId, company.companyId, company.timeZone, attempt]);

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data || !draft) return <Spinner label={t('common.loading')} />;
  if (claimId && !data.claim) return <Alert tone="error">{t('books.notFound')}</Alert>;
  if (data.claim && !data.claim.can_edit) return <Alert tone="info">{t('claims.notEditable')}</Alert>;
  if (data.projects.length === 0) {
    return <Card><EmptyState icon={<FolderX className="h-6 w-6" />} title={t('claims.noProjects')} /></Card>;
  }

  const set = (key: FieldKey, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(d: Draft): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {};
    const required = t('claims.required');
    (['project', 'date', 'category', 'item', 'description'] as FieldKey[]).forEach((k) => {
      if (!d[k].trim()) next[k] = required;
    });
    const amount = normalizeAmount(d.amount);
    if (!amount) next.amount = required;
    else if (!isValidAmount(amount, company.currency) || !/[1-9]/.test(amount)) next.amount = t('claims.amountInvalid', { n: currencyDecimals(company.currency) });
    if (!d.receipt.trim()) next.receipt = required;
    else if (!/^https?:\/\/\S+$/i.test(d.receipt.trim())) next.receipt = t('claims.receiptInvalid');
    return next;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setFormError(null);
    const found = validate(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setBusy(true);
    const { error } = await supabase.rpc('submit_site_claim', {
      p_company: company.companyId,
      p_claim: claimId,
      p_project: draft.project,
      p_date: draft.date,
      p_amount: normalizeAmount(draft.amount),
      p_category: draft.category,
      p_item_code: draft.item,
      p_description: draft.description.trim(),
      p_receipt_link: draft.receipt.trim(),
    });
    setBusy(false);
    if (error) return setFormError(dbErrorText(error, t));
    navigate('/my-claims', { state: { sent: true } });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-5 p-5 sm:p-6">
        {data.claim?.state === 'rejected' && data.claim.reject_comment && (
          <Alert tone="warning">
            <span className="font-semibold">{t('claims.officeComment')}: </span>
            <span dir="auto">{data.claim.reject_comment}</span>
          </Alert>
        )}
        <Field label={t('claims.field.project')} error={errors.project}>
          {(id, d, invalid) => (
            <SelectInput id={id} value={draft.project} onChange={(e) => set('project', e.target.value)} aria-describedby={d} invalid={invalid} className="min-h-[3rem]">
              <option value="">{t('claims.choose')}</option>
              {data.projects.map((p) => <option key={p.project_id} value={p.project_id}>{`${p.project_code} · ${p.project_name}`}</option>)}
            </SelectInput>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('claims.field.date')} error={errors.date}>
            {(id, d, invalid) => <TextInput id={id} type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} aria-describedby={d} invalid={invalid} className="min-h-[3rem]" />}
          </Field>
          <Field label={t('claims.field.amount', { currency: company.currency })} error={errors.amount}>
            {(id, d, invalid) => (
              <TextInput id={id} dir="ltr" inputMode="decimal" autoComplete="off" value={draft.amount} onChange={(e) => set('amount', e.target.value)} aria-describedby={d} invalid={invalid} className="min-h-[3rem] tabular-nums" placeholder="0.00" />
            )}
          </Field>
        </div>
        <Field label={t('claims.field.category')} error={errors.category}>
          {(id, d, invalid) => (
            <SelectInput id={id} value={draft.category} onChange={(e) => set('category', e.target.value)} aria-describedby={d} invalid={invalid} className="min-h-[3rem]">
              <option value="">{t('claims.choose')}</option>
              {data.centres.map((c) => <option key={c.code} value={c.code}>{`${c.code} · ${(lang === 'ar' && c.name_ar) || c.name_en}`}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={t('claims.field.item')} error={errors.item}>
          {() => <ItemCodePicker value={draft.item} items={data.items} invalid={!!errors.item} onChange={(code) => set('item', code)} aria-label={t('claims.field.item')} />}
        </Field>
        <Field label={t('claims.field.description')} error={errors.description}>
          {(id, d, invalid) => <TextArea id={id} dir="auto" rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} aria-describedby={d} invalid={invalid} />}
        </Field>
        <Field label={t('claims.field.receipt')} error={errors.receipt} hint={t('claims.receiptHint')}>
          {(id, d, invalid) => (
            <TextInput id={id} type="url" dir="ltr" inputMode="url" autoComplete="off" placeholder="https://" value={draft.receipt} onChange={(e) => set('receipt', e.target.value)} aria-describedby={d} invalid={invalid} className="min-h-[3rem]" />
          )}
        </Field>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" full loading={busy} icon={<Send className="h-5 w-5 rtl:-scale-x-100" />} className="min-h-[3rem] text-base">
          {t('claims.send')}
        </Button>
      </Card>
    </form>
  );
}
