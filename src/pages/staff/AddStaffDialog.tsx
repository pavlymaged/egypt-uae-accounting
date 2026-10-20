import { useState } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { describeInviteFailure, sendInvite } from '../../lib/invite';
import type { StaffRole } from '../../types';
import { EMAIL_RE } from '../auth/LoginPage';

interface Props {
  open: boolean;
  roles: readonly StaffRole[];
  onClose: () => void;
  onInvited: (email: string) => void;
}

type Errors = Partial<Record<'full_name' | 'email' | 'role' | 'joining_date', string>>;

export function AddStaffDialog({ open, roles, onClose, onInvited }: Props) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [position, setPosition] = useState('');
  const [joining, setJoining] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFullName('');
    setEmail('');
    setRole('');
    setPosition('');
    setJoining('');
    setErrors({});
    setFormError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    setFormError(null);
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
    const result = await sendInvite('invite-staff', {
      email: cleanEmail,
      full_name: name,
      staff_role: role,
      position_title: position.trim() || undefined,
      joining_date: joining || undefined,
    });
    setBusy(false);

    if (result.ok) {
      reset();
      onInvited(cleanEmail);
      return;
    }
    const problem = describeInviteFailure(result);
    const message = t(problem.key, problem.vars);
    if (problem.field) setErrors({ [problem.field]: message });
    else setFormError(message);
  }

  return (
    <Modal
      open={open}
      title={t('invite.staffTitle')}
      description={t('invite.staffBody')}
      submitLabel={t('invite.send')}
      busy={busy}
      onSubmit={() => void submit()}
      onClose={close}
    >
      {formError && <Alert tone="error">{formError}</Alert>}
      <Field label={t('invite.fullName')} error={errors.full_name}>
        {(id, d, invalid) => <TextInput id={id} maxLength={200} value={fullName} onChange={(e) => setFullName(e.target.value)} aria-describedby={d} invalid={invalid} autoFocus />}
      </Field>
      <Field label={t('invite.email')} error={errors.email}>
        {(id, d, invalid) => (
          <TextInput id={id} type="email" dir="ltr" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={d} invalid={invalid} />
        )}
      </Field>
      <Field label={t('invite.role')} error={errors.role}>
        {(id, d, invalid) => (
          <SelectInput id={id} value={role} onChange={(e) => setRole(e.target.value as StaffRole)} aria-describedby={d} invalid={invalid}>
            <option value="" disabled>{t('invite.chooseRole')}</option>
            {roles.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </SelectInput>
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('staff.col.position')} optional>
          {(id) => <TextInput id={id} maxLength={200} value={position} onChange={(e) => setPosition(e.target.value)} />}
        </Field>
        <Field label={t('staff.col.joined')} error={errors.joining_date} optional>
          {(id, d, invalid) => <TextInput id={id} type="date" dir="ltr" value={joining} onChange={(e) => setJoining(e.target.value)} aria-describedby={d} invalid={invalid} />}
        </Field>
      </div>
    </Modal>
  );
}
