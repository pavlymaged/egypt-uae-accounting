import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useStaff } from '../../auth/SessionProvider';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { Alert, FormSection, PageHeader, Spinner } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput, Toggle } from '../../components/ui/Field';
import { translate, useI18n } from '../../i18n/I18nProvider';
import { isLastSuperAdminError, isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { STAFF_COLUMNS, STAFF_ROLES, type StaffMember, type StaffRole } from '../../types';
import { NotFoundPage } from '../NotFoundPage';
import { AssignedCompaniesSection } from './AssignedCompaniesSection';
import { PayDetailsSection } from './PayDetailsSection';
import { ActiveBadge, StaffRoleBadge } from './StaffListPage';

export function StaffEditPage() {
  const { id } = useParams();
  const me = useStaff();
  const { t } = useI18n();
  const [member, setMember] = useState<StaffMember | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    supabase
      .from('staff_members')
      .select(STAFF_COLUMNS)
      .eq('user_id', id ?? '')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && isNetworkError(error)) return setLoadState('failed');
        if (error || !data) return setLoadState('notFound');
        setMember(data as StaffMember);
        setLoadState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (loadState === 'notFound') return <NotFoundPage />;
  if (loadState === 'loading' || !me) return <Spinner label={t('common.loading')} />;
  if (loadState === 'failed' || !member) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }

  const canEdit =
    me.staff_role === 'super_admin' ||
    (me.staff_role === 'accounting_manager' && (member.staff_role === 'checker' || member.staff_role === 'accountant'));
  const canEditRole = me.staff_role === 'super_admin';

  return (
    <div className="animate-fade-in">
      <PageHeader
        back={<BackLink to="/staff" label={t('nav.staff')} />}
        title={member.full_name}
        subtitle={member.email}
        actions={
          <div className="flex items-center gap-2">
            <StaffRoleBadge role={member.staff_role} />
            <ActiveBadge active={member.is_active} />
          </div>
        }
      />
      <div className="space-y-6">
        {!canEdit && <Alert tone="info">{t('staffEdit.readOnly')}</Alert>}
        <ProfileForm key={member.user_id} member={member} canEdit={canEdit} canEditRole={canEditRole} onSaved={setMember} />
        <PayDetailsSection userId={member.user_id} canEdit={canEdit} />
        {(member.staff_role === 'checker' || member.staff_role === 'accountant') && <AssignedCompaniesSection userId={member.user_id} />}
      </div>
    </div>
  );
}

interface ProfileFormProps {
  member: StaffMember;
  canEdit: boolean;
  canEditRole: boolean;
  onSaved: (member: StaffMember) => void;
}

function ProfileForm({ member, canEdit, canEditRole, onSaved }: ProfileFormProps) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState(member.full_name);
  const [position, setPosition] = useState(member.position_title ?? '');
  const [joiningDate, setJoiningDate] = useState(member.joining_date ?? '');
  const [active, setActive] = useState(member.is_active);
  const [role, setRole] = useState<StaffRole>(member.staff_role);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    if (!fullName.trim()) {
      setNameError(t('staffEdit.nameRequired'));
      return;
    }
    setNameError(null);
    setSaving(true);
    const payload: Partial<StaffMember> = {
      full_name: fullName.trim(),
      position_title: position.trim() || null,
      joining_date: joiningDate || null,
      is_active: active,
    };
    if (canEditRole) payload.staff_role = role;
    const { data, error } = await supabase
      .from('staff_members')
      .update(payload)
      .eq('user_id', member.user_id)
      .select(STAFF_COLUMNS)
      .maybeSingle();
    setSaving(false);
    if (error) {
      if (isLastSuperAdminError(error)) setFormError([translate('en', 'staffEdit.lastSuperAdmin'), translate('ar', 'staffEdit.lastSuperAdmin')]);
      else if (isNetworkError(error)) setFormError(t('common.networkError'));
      else setFormError(t('common.saveFailed', { msg: error.message }));
      return;
    }
    if (!data) {
      setFormError(t('common.notSaved'));
      return;
    }
    const next = data as StaffMember;
    onSaved(next);
    setRole(next.staff_role);
    setActive(next.is_active);
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormSection title={t('staffEdit.profile')}>
        {formError && (
          <Alert tone="error">
            {Array.isArray(formError) ? (
              <>
                <p lang="en" dir="ltr" className="text-start">{formError[0]}</p>
                <p lang="ar" dir="rtl" className="font-arabic text-start">{formError[1]}</p>
              </>
            ) : (
              formError
            )}
          </Alert>
        )}
        {saved && <Alert tone="success">{t('staffEdit.profileSaved')}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('staffEdit.fullName')} error={nameError}>
            {(fid, describedBy, invalid) => (
              <TextInput id={fid} value={fullName} disabled={!canEdit} onChange={(e) => setFullName(e.target.value)} aria-describedby={describedBy} invalid={invalid} />
            )}
          </Field>
          <Field label={t('staffEdit.email')}>
            {(fid) => <TextInput id={fid} dir="ltr" value={member.email} disabled readOnly />}
          </Field>
          <Field label={t('staffEdit.position')} optional>
            {(fid) => <TextInput id={fid} value={position} disabled={!canEdit} onChange={(e) => setPosition(e.target.value)} />}
          </Field>
          <Field label={t('staffEdit.joiningDate')} optional>
            {(fid) => <TextInput id={fid} type="date" dir="ltr" value={joiningDate} disabled={!canEdit} onChange={(e) => setJoiningDate(e.target.value)} />}
          </Field>
          <Field label={t('staffEdit.role')} hint={!canEditRole ? t('staffEdit.roleLocked') : undefined}>
            {(fid, describedBy) => (
              <SelectInput id={fid} value={role} disabled={!canEdit || !canEditRole} onChange={(e) => setRole(e.target.value as StaffRole)} aria-describedby={describedBy}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{t(`role.${r}`)}</option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        <div className="rounded-lg border border-ink-200 p-4">
          <Toggle checked={active} disabled={!canEdit} onChange={setActive} label={t('staffEdit.active')} description={t('staffEdit.activeHelp')} />
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              {saving ? t('common.saving') : t('staffEdit.saveProfile')}
            </Button>
          </div>
        )}
      </FormSection>
    </form>
  );
}
