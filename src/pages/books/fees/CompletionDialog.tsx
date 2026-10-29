import { useEffect, useState } from 'react';
import { Alert } from '../../../components/ui/Feedback';
import { Field, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { trimZeros } from '../../../lib/decimal';
import { normalizeAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, fieldFromMessage } from '../books';

type CompletionField = 'percent' | 'note';
const PREFIXES: [string, CompletionField][] = [
  ['Completion:', 'percent'],
  ['Note:', 'note'],
];

interface Props {
  open: boolean;
  companyId: string;
  projectId: string;
  current: string | null;
  onClose: () => void;
  onDone: () => void;
}

export function CompletionDialog({ open, companyId, projectId, current, onClose, onDone }: Props) {
  const { t } = useI18n();
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: CompletionField | null; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPercent('');
    setNote('');
    setError(null);
    setBusy(false);
  }, [open]);

  async function save() {
    const value = normalizeAmount(percent).replace(/%$/, '').trim();
    if (!/^\d+(\.\d+)?$/.test(value)) return setError({ field: 'percent', text: t('feeProgress.err.percent') });
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('set_project_completion', {
      p_company: companyId,
      p_project: projectId,
      p_percent: value,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      const text = dbErrorText(rpcError, t);
      return setError({ field: fieldFromMessage(text, PREFIXES), text });
    }
    onDone();
  }

  const errorFor = (field: CompletionField) => (error?.field === field ? error.text : null);

  return (
    <Modal
      open={open}
      title={t('feeProgress.recordTitle')}
      description={current === null ? t('feeProgress.recordHintNone') : t('feeProgress.recordHint', { percent: trimZeros(current) })}
      submitLabel={busy ? t('common.saving') : t('feeProgress.record')}
      busy={busy}
      onSubmit={save}
      onClose={onClose}
    >
      {error && !error.field && <Alert tone="error">{error.text}</Alert>}
      <Field label={t('feeProgress.field.percent')} error={errorFor('percent')} hint={t('feeProgress.percentHint')}>
        {(id, d, invalid) => (
          <div className="relative">
            <TextInput id={id} aria-describedby={d} invalid={invalid} inputMode="decimal" dir="ltr" autoFocus value={percent} placeholder="0.00" onChange={(e) => setPercent(e.target.value)} className="pe-9" />
            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-ink-500">%</span>
          </div>
        )}
      </Field>
      <Field label={t('feeProgress.field.note')} optional error={errorFor('note')} hint={t('feeProgress.noteHint')}>
        {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Modal>
  );
}
