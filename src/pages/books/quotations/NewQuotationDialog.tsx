import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import { CURRENCIES, type Currency } from '../../../types';
import { dbErrorText, type BooksAccess } from '../books';
import type { Engagement } from '../vendors/vendors';

interface Props {
  open: boolean;
  access: BooksAccess;
  engagements: Engagement[];
  engagementId: string | null;
  today: string;
  onClose: () => void;
  onCreated: (quotationId: string) => void;
}

export function NewQuotationDialog({ open, access, engagements, engagementId, today, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [engagement, setEngagement] = useState('');
  const [date, setDate] = useState(today);
  const [currency, setCurrency] = useState<Currency>(access.currency);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => engagements.filter((e) => (e.is_active && e.vendor_active) || e.engagement_id === engagementId), [engagements, engagementId]);
  const preset = engagements.find((e) => e.engagement_id === engagementId) ?? null;

  useEffect(() => {
    if (!open) return;
    setEngagement(engagementId ?? '');
    setDate(today);
    setCurrency(access.currency);
    setNotes('');
    setError(null);
  }, [open, engagementId, today, access.currency]);

  async function submit() {
    if (!engagement) return setError(t('quotations.chooseEngagement'));
    if (!date) return setError(t('quotations.dateRequired'));
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_quotation', {
      p_company: access.companyId,
      p_engagement: engagement,
      p_date: date,
      p_currency: currency,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (rpcError || typeof data !== 'string') return setError(dbErrorText(rpcError, t));
    onCreated(data);
  }

  return (
    <Modal open={open} title={t('quotations.newTitle')} description={t('quotations.newIntro')} submitLabel={t('quotations.createAndEdit')} busy={busy} onSubmit={submit} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {preset ? (
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm">
            <p dir="ltr" className="font-mono text-xs font-semibold text-brand-700 rtl:text-end">{preset.vendor_code}</p>
            <p dir="auto" className="font-medium text-ink-900">{preset.vendor_name}</p>
            <p dir="auto" className="text-ink-500">{`${preset.project_code} - ${preset.project_name}`}</p>
          </div>
        ) : (
          <Field label={t('quotations.field.vendor')} hint={options.length ? undefined : t('quotations.noEngagements')}>
            {(id, d) => (
              <SelectInput id={id} aria-describedby={d} value={engagement} onChange={(e) => setEngagement(e.target.value)}>
                <option value="">{t('quotations.chooseEngagement')}</option>
                {options.map((e) => (
                  <option key={e.engagement_id} value={e.engagement_id}>{`${e.vendor_code} - ${e.vendor_name}`}</option>
                ))}
              </SelectInput>
            )}
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('quotations.field.date')}>
            {(id) => <TextInput id={id} type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label={t('quotations.field.currency')}>
            {(id) => (
              <SelectInput id={id} dir="ltr" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        <Field label={t('quotations.field.notes')} optional>
          {(id) => <TextArea id={id} dir="auto" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
