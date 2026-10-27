import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Field, TextArea, TextInput, Toggle } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { dbErrorText, fieldFromMessage, type Client } from './books';

type ClientField = 'name' | 'phone' | 'email' | 'notes';

const PREFIXES: [string, ClientField][] = [
  ['Name:', 'name'],
  ['Phone:', 'phone'],
  ['Email:', 'email'],
  ['Notes:', 'notes'],
];

interface Props {
  open: boolean;
  companyId: string;
  client: Client | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
}

export function ClientDialog({ open, companyId, client, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: ClientField | null; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(client?.name ?? '');
    setPhone(client?.phone ?? '');
    setEmail(client?.email ?? '');
    setNotes(client?.notes ?? '');
    setActive(client?.is_active ?? true);
    setError(null);
  }, [open, client]);

  async function save() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('save_client', {
      p_company: companyId,
      p_id: client?.id ?? null,
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_email: email.trim(),
      p_notes: notes.trim(),
      p_active: active,
    });
    setBusy(false);
    if (rpcError || typeof data !== 'string') {
      const text = dbErrorText(rpcError, t);
      return setError({ field: fieldFromMessage(text, PREFIXES), text });
    }
    onSaved({ id: data, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null, is_active: active });
  }

  const errorFor = (field: ClientField) => (error?.field === field ? error.text : null);

  return (
    <Modal
      open={open}
      title={client ? t('clients.editTitle') : t('clients.addTitle')}
      submitLabel={busy ? t('common.saving') : t('common.save')}
      busy={busy}
      onSubmit={save}
      onClose={onClose}
    >
      {error && !error.field && <Alert tone="error">{error.text}</Alert>}
      <Field label={t('clients.field.name')} error={errorFor('name')}>
        {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} value={name} maxLength={200} autoFocus onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('clients.field.phone')} optional error={errorFor('phone')}>
          {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label={t('clients.field.email')} optional error={errorFor('email')}>
          {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
      </div>
      <Field label={t('clients.field.notes')} optional error={errorFor('notes')}>
        {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <Toggle checked={active} onChange={setActive} label={t('common.active')} description={t('clients.activeHint')} />
    </Modal>
  );
}
