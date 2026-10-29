import { CheckCheck, Pencil, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Badge } from '../../../components/ui/Feedback';
import { Field, TextArea } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import type { TranslationKey } from '../../../i18n/en';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import { dbErrorText } from '../books';
import { STATUS_LABEL, type EntryStatus, type EntryWorkflow } from './entries';

const STATUS_TONE: Record<EntryStatus, 'neutral' | 'sky' | 'warning' | 'success' | 'danger'> = {
  draft: 'neutral',
  submitted: 'sky',
  rejected: 'warning',
  posted: 'success',
  reversed: 'danger',
};

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const { t } = useI18n();
  return <Badge tone={STATUS_TONE[status]}>{t(STATUS_LABEL[status])}</Badge>;
}

export type EntryKind = 'payment' | 'feeCharge';

const TEXT: Record<EntryKind, Record<'submitted' | 'posted' | 'rejected' | 'reversed' | 'rejectTitle' | 'reverseTitle' | 'discardTitle' | 'discardBody', TranslationKey>> = {
  payment: {
    submitted: 'payments.done.submitted',
    posted: 'payments.done.posted',
    rejected: 'payments.done.rejected',
    reversed: 'payments.done.reversed',
    rejectTitle: 'payments.rejectTitle',
    reverseTitle: 'payments.reverseTitle',
    discardTitle: 'payments.discardTitle',
    discardBody: 'payments.discardBody',
  },
  feeCharge: {
    submitted: 'feeCharges.done.submitted',
    posted: 'feeCharges.done.posted',
    rejected: 'feeCharges.done.rejected',
    reversed: 'feeCharges.done.reversed',
    rejectTitle: 'feeCharges.rejectTitle',
    reverseTitle: 'feeCharges.reverseTitle',
    discardTitle: 'feeCharges.discardTitle',
    discardBody: 'feeCharges.discardBody',
  },
};

type Dialog = 'reject' | 'reverse' | 'discard' | null;
type Flags = Pick<EntryWorkflow, 'entry_id' | 'can_edit' | 'can_submit' | 'can_post' | 'can_reject' | 'can_reverse' | 'can_discard'>;

interface Props {
  entry: Flags;
  kind: EntryKind;
  onEdit: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

export function EntryActions({ entry, kind, onEdit, onDone, onError }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const words = TEXT[kind];

  async function run(key: string, call: () => PromiseLike<{ error: { message?: string } | null }>, success: TranslationKey) {
    setBusy(key);
    setDialogError(null);
    const { error } = await call();
    setBusy(null);
    if (error) {
      if (dialog === 'reject' || dialog === 'reverse') return setDialogError(dbErrorText(error, t));
      setDialog(null);
      return onError(dbErrorText(error, t));
    }
    setDialog(null);
    setText('');
    onDone(t(success));
  }

  const open = (d: Dialog) => {
    setText('');
    setDialogError(null);
    setDialog(d);
  };

  const id = entry.entry_id;
  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {entry.can_edit && <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>{t('common.edit')}</Button>}
      {entry.can_submit && (
        <Button variant="secondary" icon={<Send className="h-4 w-4" />} loading={busy === 'submit'} disabled={!!busy} onClick={() => run('submit', () => supabase.rpc('submit_entry', { p_entry: id }), words.submitted)}>
          {t('payments.action.submit')}
        </Button>
      )}
      {entry.can_post && (
        <Button icon={<CheckCheck className="h-4 w-4" />} loading={busy === 'post'} disabled={!!busy} onClick={() => run('post', () => supabase.rpc('post_entry', { p_entry: id }), words.posted)}>
          {t('payments.action.post')}
        </Button>
      )}
      {entry.can_reject && <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} disabled={!!busy} onClick={() => open('reject')}>{t('payments.action.reject')}</Button>}
      {entry.can_reverse && <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} disabled={!!busy} onClick={() => open('reverse')}>{t('payments.action.reverse')}</Button>}
      {entry.can_discard && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} disabled={!!busy} onClick={() => open('discard')}>{t('payments.action.discard')}</Button>}

      <Modal
        open={dialog === 'reject' || dialog === 'reverse'}
        title={t(dialog === 'reverse' ? words.reverseTitle : words.rejectTitle)}
        description={t(dialog === 'reverse' ? 'payments.reverseHint' : 'payments.rejectHint')}
        submitLabel={t(dialog === 'reverse' ? 'payments.action.reverse' : 'payments.action.reject')}
        submitTone={dialog === 'reverse' ? 'danger' : 'primary'}
        busy={!!busy}
        onClose={() => setDialog(null)}
        onSubmit={() =>
          dialog === 'reverse'
            ? run('reverse', () => supabase.rpc('reverse_entry', { p_entry: id, p_reason: text }), words.reversed)
            : run('reject', () => supabase.rpc('reject_entry', { p_entry: id, p_comment: text }), words.rejected)
        }
      >
        <Field label={t(dialog === 'reverse' ? 'payments.field.reverseReason' : 'payments.field.rejectComment')} error={dialogError}>
          {(fid, describedBy, invalid) => <TextArea id={fid} aria-describedby={describedBy} invalid={invalid} value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />}
        </Field>
      </Modal>

      <ConfirmDialog
        open={dialog === 'discard'}
        title={t(words.discardTitle)}
        confirmLabel={t('payments.action.discard')}
        tone="danger"
        loading={busy === 'discard'}
        onCancel={() => setDialog(null)}
        onConfirm={() => run('discard', () => supabase.rpc('discard_entry', { p_entry: id }), 'payments.done.discarded')}
      >
        {t(words.discardBody)}
      </ConfirmDialog>
    </div>
  );
}
