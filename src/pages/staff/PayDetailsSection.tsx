import { ShieldAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, FormSection, Spinner } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { ageFromBirthDate, todayIso } from '../../lib/dates';
import { isNetworkError } from '../../lib/errors';
import { currencyDecimals, formatAmount, isValidAmount, normalizeAmount } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, SALARY_FREQUENCIES, type Currency, type SalaryFrequency, type StaffHrDetails } from '../../types';

const HR_COLUMNS = 'user_id, date_of_birth, basic_salary::text, salary_currency, salary_frequency';

type Errors = Partial<Record<'dob' | 'salary' | 'currency', string>>;

export function PayDetailsSection({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const { t } = useI18n();
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [dob, setDob] = useState('');
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState<Currency | ''>('');
  const [frequency, setFrequency] = useState<SalaryFrequency | ''>('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function apply(row: StaffHrDetails | null) {
    setDob(row?.date_of_birth ?? '');
    setSalary(row?.basic_salary ?? '');
    setCurrency(row?.salary_currency ?? '');
    setFrequency(row?.salary_frequency ?? '');
  }

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    supabase
      .from('staff_hr_details')
      .select(HR_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setLoadState('failed');
        apply(data as unknown as StaffHrDetails | null);
        setLoadState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    const amount = normalizeAmount(salary);
    const next: Errors = {};
    if (dob && dob > todayIso()) next.dob = t('pay.dobFuture');
    if (amount && !currency) next.currency = t('pay.currencyRequired');
    if (amount && currency && !isValidAmount(amount, currency)) {
      next.salary = t('pay.salaryInvalid', { d: currencyDecimals(currency), cur: currency });
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('staff_hr_details')
      .upsert(
        {
          user_id: userId,
          date_of_birth: dob || null,
          basic_salary: amount || null,
          salary_currency: currency || null,
          salary_frequency: frequency || null,
        },
        { onConflict: 'user_id' },
      )
      .select(HR_COLUMNS)
      .maybeSingle();
    setSaving(false);
    if (error) {
      setFormError(isNetworkError(error) ? t('common.networkError') : t('common.saveFailed', { msg: error.message }));
      return;
    }
    if (!data) {
      setFormError(t('common.notSaved'));
      return;
    }
    apply(data as unknown as StaffHrDetails);
    setSaved(true);
  }

  const age = ageFromBirthDate(dob);
  const amount = normalizeAmount(salary);
  const preview = amount && currency && isValidAmount(amount, currency) ? formatAmount(amount, currency) : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormSection
        title={t('pay.title')}
        description={
          <span className="inline-flex items-center gap-1.5 text-gold-800">
            <ShieldAlert className="h-4 w-4" />
            {t('pay.note')}
          </span>
        }
      >
        {loadState === 'loading' && <Spinner />}
        {loadState === 'failed' && (
          <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
            {t('common.loadFailed')}
          </Alert>
        )}
        {loadState === 'ready' && (
          <>
            {formError && <Alert tone="error">{formError}</Alert>}
            {saved && <Alert tone="success">{t('pay.saved')}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('pay.dob')} error={errors.dob} optional>
                {(fid, describedBy, invalid) => (
                  <TextInput
                    id={fid}
                    type="date"
                    dir="ltr"
                    max={todayIso()}
                    value={dob}
                    disabled={!canEdit}
                    onChange={(e) => setDob(e.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              <Field label={t('pay.age')}>
                {(fid) => (
                  <TextInput id={fid} readOnly disabled value={age === null ? t('common.notSet') : t('pay.ageValue', { n: age })} />
                )}
              </Field>
              <Field
                label={t('pay.salary')}
                error={errors.salary}
                optional
                hint={preview && <span dir="ltr" className="tabular-nums">{preview}</span>}
              >
                {(fid, describedBy, invalid) => (
                  <div className="relative">
                    <TextInput
                      id={fid}
                      dir="ltr"
                      inputMode="decimal"
                      value={salary}
                      disabled={!canEdit}
                      onChange={(e) => {
                        setSalary(e.target.value);
                        setErrors((er) => ({ ...er, salary: undefined }));
                      }}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      className="pe-14 tabular-nums"
                    />
                    {currency && (
                      <span dir="ltr" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-ink-500">
                        {currency}
                      </span>
                    )}
                  </div>
                )}
              </Field>
              <Field label={t('pay.currency')} error={errors.currency} optional>
                {(fid, describedBy, invalid) => (
                  <SelectInput
                    id={fid}
                    dir="ltr"
                    value={currency}
                    disabled={!canEdit}
                    onChange={(e) => {
                      setCurrency(e.target.value as Currency | '');
                      setErrors((er) => ({ ...er, currency: undefined, salary: undefined }));
                    }}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  >
                    <option value="">{t('pay.choose')}</option>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </SelectInput>
                )}
              </Field>
              <Field label={t('pay.frequency')} optional>
                {(fid) => (
                  <SelectInput id={fid} value={frequency} disabled={!canEdit} onChange={(e) => setFrequency(e.target.value as SalaryFrequency | '')}>
                    <option value="">{t('pay.choose')}</option>
                    {SALARY_FREQUENCIES.map((f) => <option key={f} value={f}>{t(`pay.freq.${f}`)}</option>)}
                  </SelectInput>
                )}
              </Field>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  {saving ? t('common.saving') : t('pay.save')}
                </Button>
              </div>
            )}
          </>
        )}
      </FormSection>
    </form>
  );
}
