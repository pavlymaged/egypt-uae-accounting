import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Field, TextInput, Toggle } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { ITEM_CODE_COLUMNS, type ItemCode } from './itemCodes';

export function ItemCodeEditDialog({ item, onClose, onSaved }: { item: ItemCode | null; onClose: () => void; onSaved: (item: ItemCode) => void }) {
  const { t } = useI18n();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setNameEn(item.name_en);
    setNameAr(item.name_ar ?? '');
    setActive(item.is_active);
    setError(null);
    setNameError(null);
  }, [item]);

  async function save() {
    if (!item) return;
    const en = nameEn.trim();
    if (!en) {
      setNameError(t('ref.edit.nameRequired'));
      return;
    }
    setNameError(null);
    setError(null);
    setBusy(true);
    try {
      const { data, error: err } = await supabase
        .from('item_codes')
        .update({ name_en: en, name_ar: nameAr.trim() || null, is_active: active })
        .eq('code', item.code)
        .select(ITEM_CODE_COLUMNS);
      if (err) setError(isNetworkError(err) ? t('common.networkError') : t('ref.edit.failed'));
      else if (!data || data.length === 0) setError(t('ref.edit.notFound'));
      else onSaved(data[0] as ItemCode);
    } catch (e) {
      setError(isNetworkError(e) ? t('common.networkError') : t('common.unexpected'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={item !== null}
      title={item ? t('ref.edit.title', { code: item.code }) : ''}
      description={t('ref.edit.note')}
      submitLabel={t('common.save')}
      busy={busy}
      onSubmit={save}
      onClose={onClose}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t('ref.col.nameEn')} error={nameError}>
        {(id, describedBy, invalid) => (
          <TextInput id={id} aria-describedby={describedBy} invalid={invalid} dir="ltr" value={nameEn} maxLength={200} onChange={(e) => setNameEn(e.target.value)} disabled={busy} />
        )}
      </Field>
      <Field label={t('ref.col.nameAr')} optional>
        {(id, describedBy) => (
          <TextInput id={id} aria-describedby={describedBy} dir="rtl" lang="ar" value={nameAr} maxLength={200} onChange={(e) => setNameAr(e.target.value)} disabled={busy} />
        )}
      </Field>
      <Toggle checked={active} onChange={setActive} disabled={busy} label={t('common.active')} description={t('ref.edit.activeHint')} />
    </Modal>
  );
}
