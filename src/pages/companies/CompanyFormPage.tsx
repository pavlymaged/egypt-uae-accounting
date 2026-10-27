import { Info, Lock } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, FormSection, PageHeader, Spinner } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import type { TranslationKey } from '../../i18n/en';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError, isUniqueViolation } from '../../lib/errors';
import { currencyDecimals, formatAmount, isValidAmount, normalizeAmount } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import {
  COMPANY_COLUMNS,
  COMPANY_STATUSES,
  CURRENCIES,
  SERVICE_MODELS,
  type Company,
  type CompanyStatus,
  type Currency,
  type ServiceModel,
} from '../../types';
import { EMAIL_RE } from '../auth/LoginPage';
import { NotFoundPage } from '../NotFoundPage';
import { AssignedStaffPanel } from './AssignedStaffPanel';
import { CompanyStatusBadge } from './CompanyBadges';
import { useStaff } from '../../auth/SessionProvider';
import { useSupportSession } from '../../support/SupportSessionProvider';
import { BookPanel } from '../books/BookPanel';
import { staffBooksAccess } from '../books/books';
import { adminCompanyTabs, CompanyTabs, useCompanyTab } from './CompanyTabs';
import { CompanyUsersPanel } from './CompanyUsersPanel';
import { SupportPanel } from './SupportPanel';

interface FormValues {
  code: string;
  name: string;
  service_model: ServiceModel;
  status: CompanyStatus;
  base_currency: Currency;
  monthly_service_fee: string;
  service_fee_currency: Currency;
  owner_name: string;
  owner_email: string;
}

type FieldName = 'code' | 'name' | 'monthly_service_fee' | 'owner_email';
type Errors = Partial<Record<FieldName, string>>;

const EMPTY: FormValues = {
  code: '',
  name: '',
  service_model: 'managed',
  status: 'active',
  base_currency: 'EGP',
  monthly_service_fee: '0',
  service_fee_currency: 'EGP',
  owner_name: '',
  owner_email: '',
};

const CODE_RE = /^[A-Z0-9_-]{2,20}$/;

function toValues(c: Company): FormValues {
  return {
    code: c.code,
    name: c.name,
    service_model: c.service_model,
    status: c.status,
    base_currency: c.base_currency,
    monthly_service_fee: c.monthly_service_fee,
    service_fee_currency: c.service_fee_currency,
    owner_name: c.owner_name ?? '',
    owner_email: c.owner_email ?? '',
  };
}

export function CompanyFormPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [company, setCompany] = useState<Company | null>(null);
  const staff = useStaff();
  const { active: support } = useSupportSession();
  const books = company && staff ? staffBooksAccess(staff.staff_role, company, support) : null;
  const tabs = adminCompanyTabs(company, !!books);
  const [tab, setTab] = useCompanyTab(tabs);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'failed'>(isNew ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<TranslationKey | null>(
    (location.state as { created?: boolean } | null)?.created ? 'companyForm.created' : null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoadState('loading');
    supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && isNetworkError(error)) return setLoadState('failed');
        if (error || !data) return setLoadState('notFound');
        const c = data as unknown as Company;
        setCompany(c);
        setValues(toValues(c));
        setLoadState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNew, attempt]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSuccess(null);
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onModelChange(model: ServiceModel) {
    if (values.service_model === 'managed' && model === 'self_service') setConfirmSelf(true);
    else set('service_model', model);
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!CODE_RE.test(values.code.trim())) next.code = t('companyForm.codeInvalid');
    if (!values.name.trim()) next.name = t('companyForm.nameRequired');
    const fee = normalizeAmount(values.monthly_service_fee);
    if (!isValidAmount(fee, values.service_fee_currency)) {
      next.monthly_service_fee = t('companyForm.feeInvalid', { d: currencyDecimals(values.service_fee_currency), cur: values.service_fee_currency });
    }
    const email = values.owner_email.trim();
    if (email && !EMAIL_RE.test(email)) next.owner_email = t('companyForm.ownerEmailInvalid');
    return next;
  }

  function describeError(error: { message: string; code?: string }): string {
    if (isNetworkError(error)) return t('common.networkError');
    return t('common.saveFailed', { msg: error.message });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setFormError(t('companyForm.fixErrors'));
      return;
    }

    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      service_model: values.service_model,
      status: values.status,
      base_currency: values.base_currency,
      monthly_service_fee: normalizeAmount(values.monthly_service_fee),
      service_fee_currency: values.service_fee_currency,
      owner_name: values.owner_name.trim() || null,
      owner_email: values.owner_email.trim() || null,
    };

    setSaving(true);
    const query = isNew
      ? supabase.from('companies').insert(payload).select(COMPANY_COLUMNS).maybeSingle()
      : supabase.from('companies').update(payload).eq('id', id).select(COMPANY_COLUMNS).maybeSingle();
    const { data, error } = await query;
    setSaving(false);

    if (error) {
      if (isUniqueViolation(error)) {
        setErrors({ code: t('companyForm.codeTaken') });
        setFormError(t('companyForm.fixErrors'));
      } else {
        setFormError(describeError(error));
      }
      return;
    }
    if (!data) {
      setFormError(t('common.notSaved'));
      return;
    }
    const saved = data as unknown as Company;
    if (isNew) {
      navigate(`/companies/${saved.id}`, { replace: true, state: { created: true } });
      return;
    }
    setCompany(saved);
    setValues(toValues(saved));
    setSuccess('companyForm.saved');
  }

  async function onClose() {
    setClosing(true);
    const { data, error } = await supabase
      .from('companies')
      .update({ status: 'closed' })
      .eq('id', id)
      .select(COMPANY_COLUMNS)
      .maybeSingle();
    setClosing(false);
    setConfirmClose(false);
    if (error) return setFormError(describeError(error));
    if (!data) return setFormError(t('common.notSaved'));
    const saved = data as unknown as Company;
    setCompany(saved);
    setValues(toValues(saved));
    setSuccess('companyForm.closedDone');
  }

  if (loadState === 'notFound') return <NotFoundPage />;
  if (loadState === 'loading') return <Spinner label={t('common.loading')} />;
  if (loadState === 'failed') {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }

  const decimals = currencyDecimals(values.service_fee_currency);
  const feePreview = isValidAmount(normalizeAmount(values.monthly_service_fee), values.service_fee_currency)
    ? formatAmount(normalizeAmount(values.monthly_service_fee), values.service_fee_currency)
    : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        back={<BackLink to="/companies" label={t('nav.companies')} />}
        title={isNew ? t('companyForm.createTitle') : company?.name ?? ''}
        subtitle={isNew ? undefined : t('companyForm.editTitle')}
        actions={
          company && company.status !== 'closed' ? (
            <Button variant="secondary" onClick={() => setConfirmClose(true)} icon={<Lock className="h-4 w-4" />}>
              {t('companyForm.close')}
            </Button>
          ) : company ? (
            <CompanyStatusBadge status={company.status} />
          ) : null
        }
      />

      {company && <CompanyTabs tabs={tabs} tab={tab} onChange={setTab} />}

      {company && !books && company.service_model === 'self_service' && tab === 'details' && (
        <div className="mb-6">
          <Alert tone="info">{t('books.needSupport')}</Alert>
        </div>
      )}
      {books && (tab === 'projects' || tab === 'clients' || tab === 'cash') && <BookPanel section={tab} access={books} />}

      {company && tab === 'users' && <CompanyUsersPanel company={company} asAdmin />}
      {company && tab === 'staff' && <AssignedStaffPanel company={company} />}
      {company && tab === 'support' && <SupportPanel company={company} />}

      <form onSubmit={onSubmit} noValidate className={tab === 'details' ? 'space-y-6' : 'hidden'}>
        {formError && <Alert tone="error">{formError}</Alert>}
        {success && <Alert tone="success">{t(success)}</Alert>}
        {company?.status === 'closed' && <Alert tone="info">{t('companyForm.closedNotice')}</Alert>}

        <FormSection title={t('companyForm.sectionCompany')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('companyForm.code')} error={errors.code} hint={t('companyForm.codeHint')}>
              {(fid, describedBy, invalid) => (
                <TextInput
                  id={fid}
                  dir="ltr"
                  maxLength={20}
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={values.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="font-mono uppercase"
                />
              )}
            </Field>
            <Field label={t('companyForm.name')} error={errors.name}>
              {(fid, describedBy, invalid) => (
                <TextInput id={fid} value={values.name} onChange={(e) => set('name', e.target.value)} aria-describedby={describedBy} invalid={invalid} />
              )}
            </Field>
            <Field label={t('companyForm.status')}>
              {(fid) => (
                <SelectInput id={fid} value={values.status} onChange={(e) => set('status', e.target.value as CompanyStatus)}>
                  {COMPANY_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`status.${s}`)}</option>
                  ))}
                </SelectInput>
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection title={t('companyForm.sectionService')}>
          <div role="radiogroup" aria-label={t('companyForm.sectionService')} className="grid gap-3 sm:grid-cols-2">
            {SERVICE_MODELS.map((m) => {
              const selected = values.service_model === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onModelChange(m)}
                  className={`rounded-xl border p-4 text-start transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    selected ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-brand-600' : 'border-ink-300'}`}>
                      {selected && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                    </span>
                    <span className="text-sm font-semibold text-ink-900">{t(`model.${m}`)}</span>
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-ink-600">
                    {t(m === 'managed' ? 'model.managedHelp' : 'model.selfHelp')}
                  </span>
                </button>
              );
            })}
          </div>
        </FormSection>

        <FormSection title={t('companyForm.sectionBilling')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('companyForm.baseCurrency')}>
              {(fid) => (
                <SelectInput id={fid} dir="ltr" value={values.base_currency} onChange={(e) => set('base_currency', e.target.value as Currency)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              )}
            </Field>
            <div className="hidden sm:block" />
            <Field
              label={t('companyForm.fee')}
              error={errors.monthly_service_fee}
              hint={feePreview && <span dir="ltr" className="tabular-nums">{feePreview}</span>}
            >
              {(fid, describedBy, invalid) => (
                <div className="relative">
                  <TextInput
                    id={fid}
                    dir="ltr"
                    inputMode="decimal"
                    placeholder={decimals === 3 ? '0.000' : '0.00'}
                    value={values.monthly_service_fee}
                    onChange={(e) => set('monthly_service_fee', e.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    className="pe-14 tabular-nums"
                  />
                  <span dir="ltr" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-ink-500">
                    {values.service_fee_currency}
                  </span>
                </div>
              )}
            </Field>
            <Field label={t('companyForm.feeCurrency')}>
              {(fid) => (
                <SelectInput
                  id={fid}
                  dir="ltr"
                  value={values.service_fee_currency}
                  onChange={(e) => {
                    set('service_fee_currency', e.target.value as Currency);
                    setErrors((er) => ({ ...er, monthly_service_fee: undefined }));
                  }}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection title={t('companyForm.sectionOwner')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('companyForm.ownerName')} optional>
              {(fid) => <TextInput id={fid} value={values.owner_name} onChange={(e) => set('owner_name', e.target.value)} />}
            </Field>
            <Field label={t('companyForm.ownerEmail')} error={errors.owner_email} optional>
              {(fid, describedBy, invalid) => (
                <TextInput
                  id={fid}
                  type="email"
                  dir="ltr"
                  value={values.owner_email}
                  onChange={(e) => set('owner_email', e.target.value)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>
        </FormSection>

        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-ink-200 bg-ink-50/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0">
          <Button variant="secondary" onClick={() => navigate('/companies')}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>
            {saving ? t('common.saving') : isNew ? t('companyForm.create') : t('common.save')}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmSelf}
        title={t('companyForm.confirmSelfTitle')}
        confirmLabel={t('companyForm.confirmSelfOk')}
        onCancel={() => setConfirmSelf(false)}
        onConfirm={() => {
          set('service_model', 'self_service');
          setConfirmSelf(false);
        }}
      >
        <p className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          {t('companyForm.confirmSelfBody')}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClose}
        tone="danger"
        title={t('companyForm.closeTitle', { name: company?.name ?? '' })}
        confirmLabel={t('companyForm.closeOk')}
        loading={closing}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => void onClose()}
      >
        {t('companyForm.closeBody')}
      </ConfirmDialog>
    </div>
  );
}
