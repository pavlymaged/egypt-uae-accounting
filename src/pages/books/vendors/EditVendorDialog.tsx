import { useEffect, useState } from 'react';
import { Alert } from '../../../components/ui/Feedback';
import { Field, TextArea, TextInput, Toggle } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, type BooksAccess } from '../books';
import type { Vendor } from './vendors';

interface Props {
  vendor: Vendor | null;
  access: BooksAccess;
  onClose: () => void;
  onDone: (text: string) => void;
}

export function EditVendorDialog({ vendor, access, onClose, onDone }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    setName(vendor.name);
    setPhone(vendor.phone ?? '');
    setEmail(vendor.email ?? '');
    setNotes(vendor.notes ?? '');
    setActive(vendor.is_active);
    setError(null);
  }, [vendor]);

  async function submit() {
    if (!vendor) return;
    if (!name.trim()) return setError(t('vendors.nameRequired'));
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('update_vendor', {
      p_company: access.companyId,
      p_vendor: vendor.id,
      p_name: name.trim(),
      p_phone: phone.trim() || null,
      p_email: email.trim() || null,
      p_notes: notes.trim() || null,
      p_active: active,
    });
    setBusy(false);
    if (rpcError) return setError(dbErrorText(rpcError, t));
    onDone(t('vendors.done.updated'));
  }

  return (
    <Modal open={!!vendor} title={t('vendors.editTitle')} description={t('vendors.editIntro')} submitLabel={t('common.save')} busy={busy} onSubmit={submit} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label={t('vendors.field.name')}>
          {(id) => <TextInput id={id} dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('vendors.field.phone')} optional>
            {(id) => <TextInput id={id} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />}
          </Field>
          <Field label={t('vendors.field.email')} optional>
            {(id) => <TextInput id={id} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />}
          </Field>
        </div>
        <Field label={t('vendors.field.notes')} optional>
          {(id) => <TextArea id={id} dir="auto" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <Toggle checked={active} onChange={setActive} label={t('vendors.field.active')} description={t('vendors.activeHint')} />
      </div>
    </Modal>
  );
}
