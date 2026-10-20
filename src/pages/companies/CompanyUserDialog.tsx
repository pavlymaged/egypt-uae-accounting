import { useEffect, useState } from 'react';
import { AccessMethodChoice } from '../../components/access/AccessMethodChoice';
import type { SharedCredentials } from '../../components/access/ShareCredentialsDialog';
import { Alert } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput, Toggle } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { describeInviteFailure, sendInvite, type AccessMethod } from '../../lib/invite';
import { supabase } from '../../lib/supabase';
import {
  COMPANY_ROLES,
  COMPANY_USER_COLUMNS,
  PERMISSIONS,
  type CompanyRole,
  type CompanyUser,
  type Permission,
  type ServiceModel,
} from '../../types';
import { EMAIL_RE } from '../auth/LoginPage';

type Switches = Record<Permission, boolean>;

const NO_SWITCHES = Object.fromEntries(PERMISSIONS.map((p) => [p, false])) as Switches;

type Preset = 'viewer' | 'bookkeeper' | 'custom';

const PRESETS: Record<Exclude<Preset, 'custom'>, Switches> = {
  viewer: { ...NO_SWITCHES, can_view_reports: true, can_view_cash: true },
  bookkeeper: { ...NO_SWITCHES, can_record: true, can_manage_vendors: true, can_view_reports: true, can_view_cash: true },
};

function presetOf(switches: Switches, visible: readonly Permission[]): Preset {
  for (const name of ['viewer', 'bookkeeper'] as const) {
    if (visible.every((p) => PRESETS[name][p] === switches[p])) return name;
  }
  return 'custom';
}

interface Props {
  open: boolean;
  companyId: string;
  serviceModel: ServiceModel;
  canChooseOwner: boolean;
  editing: CompanyUser | null;
  onClose: () => void;
  onInvited: (email: string) => void;
  onCreated: (credentials: SharedCredentials) => void;
  onSaved: (user: CompanyUser) => void;
}

type Errors = Partial<Record<'full_name' | 'email' | 'role', string>>;

export function CompanyUserDialog({ open, companyId, serviceModel, canChooseOwner, editing, onClose, onInvited, onCreated, onSaved }: Props) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyRole | ''>('');
  const [switches, setSwitches] = useState<Switches>(PRESETS.viewer);
  const [preset, setPreset] = useState<Preset>('viewer');
  const [method, setMethod] = useState<AccessMethod>('temporary_password');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visiblePermissions = PERMISSIONS.filter((p) => p !== 'can_post' || serviceModel === 'self_service');

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    if (editing) {
      const current = Object.fromEntries(PERMISSIONS.map((p) => [p, editing[p]])) as Switches;
      setFullName(editing.full_name);
      setEmail(editing.email);
      setRole(editing.role);
      setActive(editing.is_active);
      setSwitches(current);
      setPreset(presetOf(current, PERMISSIONS.filter((p) => p !== 'can_post' || serviceModel === 'self_service')));
    } else {
      setFullName('');
      setEmail('');
      setRole('');
      setActive(true);
      setSwitches(PRESETS.viewer);
      setPreset('viewer');
      setMethod('temporary_password');
    }
  }, [open, editing, serviceModel]);

  const roles = COMPANY_ROLES.filter((r) => r !== 'owner' || canChooseOwner);
  const showSwitches = role !== '' && role !== 'site_engineer';

  function choosePreset(next: Preset) {
    setPreset(next);
    if (next !== 'custom') setSwitches(PRESETS[next]);
  }

  function effectiveSwitches(): Switches {
    if (role === 'site_engineer') return NO_SWITCHES;
    return serviceModel === 'self_service' ? switches : { ...switches, can_post: editing ? editing.can_post : false };
  }

  async function invite() {
    const cleanEmail = email.trim().toLowerCase();
    const name = fullName.trim();
    const next: Errors = {};
    if (!name) next.full_name = t('invite.nameRequired');
    else if (name.length > 200) next.full_name = t('invite.nameInvalid');
    if (!EMAIL_RE.test(cleanEmail)) next.email = t('invite.emailInvalid');
    if (!role) next.role = t('invite.roleRequired');
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    const result = await sendInvite('invite-company-user', method, {
      company_id: companyId,
      email: cleanEmail,
      full_name: name,
      role,
      ...effectiveSwitches(),
    });
    setBusy(false);
    if (result.ok) {
      if (result.temporaryPassword) return onCreated({ email: cleanEmail, password: result.temporaryPassword });
      return onInvited(cleanEmail);
    }
    const problem = describeInviteFailure(result);
    const message = t(problem.key, problem.vars);
    if (problem.field === 'email' || problem.field === 'full_name' || problem.field === 'role') setErrors({ [problem.field]: message });
    else setFormError(message);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('company_users')
      .update({ ...effectiveSwitches(), is_active: active })
      .eq('company_id', editing.company_id)
      .eq('user_id', editing.user_id)
      .select(COMPANY_USER_COLUMNS)
      .maybeSingle();
    setBusy(false);
    if (error) return setFormError(isNetworkError(error) ? t('common.networkError') : t('common.saveFailed', { msg: error.message }));
    if (!data) return setFormError(t('common.notSaved'));
    onSaved(data as unknown as CompanyUser);
  }

  return (
    <Modal
      open={open}
      wide
      title={editing ? t('cusers.editTitle', { name: editing.full_name }) : t('cusers.addTitle')}
      description={editing ? undefined : t(method === 'invite' ? 'cusers.addBody' : 'cusers.addBodyTemp')}
      submitLabel={editing ? t('common.save') : t(method === 'invite' ? 'invite.send' : 'invite.create')}
      busy={busy}
      onSubmit={() => void (editing ? save() : invite())}
      onClose={onClose}
    >
      {formError && <Alert tone="error">{formError}</Alert>}

      {editing ? (
        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm">
          <p className="font-medium text-ink-900">{editing.full_name}</p>
          <p dir="ltr" className="text-ink-500 rtl:text-end">{editing.email}</p>
          <p className="mt-1 text-ink-600">{t(`role.${editing.role}`)}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('invite.fullName')} error={errors.full_name}>
              {(id, d, invalid) => <TextInput id={id} maxLength={200} value={fullName} onChange={(e) => setFullName(e.target.value)} aria-describedby={d} invalid={invalid} autoFocus />}
            </Field>
            <Field label={t('invite.email')} error={errors.email}>
              {(id, d, invalid) => (
                <TextInput id={id} type="email" dir="ltr" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={d} invalid={invalid} />
              )}
            </Field>
          </div>
          <Field label={t('invite.role')} error={errors.role}>
            {(id, d, invalid) => (
              <SelectInput id={id} value={role} onChange={(e) => setRole(e.target.value as CompanyRole)} aria-describedby={d} invalid={invalid}>
                <option value="" disabled>{t('invite.chooseRole')}</option>
                {roles.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
              </SelectInput>
            )}
          </Field>
        </>
      )}

      {role === 'site_engineer' && <Alert tone="info">{t('cusers.engineerNote')}</Alert>}

      {showSwitches && (
        <fieldset className="space-y-4 rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-sm font-semibold text-ink-900">{t('cusers.permissions')}</legend>
          <div role="radiogroup" aria-label={t('preset.label')} className="grid grid-cols-3 gap-1 rounded-lg bg-ink-100 p-1">
            {(['viewer', 'bookkeeper', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preset === p}
                onClick={() => choosePreset(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  preset === p ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                {t(`preset.${p}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-500">{t(`preset.${preset}.help`)}</p>
          {visiblePermissions.map((p) => (
            <Toggle
              key={p}
              label={t(`perm.${p}`)}
              description={p === 'can_post' ? t('perm.postNote') : undefined}
              checked={switches[p]}
              onChange={(v) => {
                setSwitches((s) => ({ ...s, [p]: v }));
                setPreset('custom');
              }}
            />
          ))}
        </fieldset>
      )}

      {editing && (
        <div className="rounded-xl border border-ink-200 p-4">
          <Toggle label={t('cusers.activeLabel')} description={t('cusers.activeHelp')} checked={active} onChange={setActive} />
        </div>
      )}

      {!editing && <AccessMethodChoice value={method} onChange={setMethod} />}
    </Modal>
  );
}
