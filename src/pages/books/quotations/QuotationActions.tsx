import { Ban, CheckCircle2, CopyPlus, Pencil, Send, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Field, TextArea } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import { dbErrorText } from '../books';
import type { Quotation } from './quotations';

type Dialog = 'submit' | 'approve' | 'reject' | 'revise' | 'cancel';

interface Props {
  quotation: Quotation;
  onEdit: () => void;
  onDone: (text: string, openEditor?: boolean) => void;
}

const EXCESS_PREFIX = 'Payments already made';

export function QuotationActions({ quotation: q, onEdit, onDone }: Props) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [comment, setComment] = useState('');
  const [excessMessage, setExcessMessage] = useState<string | null>(null);
  const [confirmExcess, setConfirmExcess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (d: Dialog) => {
    setDialog(d);
    setComment('');
    setExcessMessage(null);
    setConfirmExcess(false);
    setError(null);
  };
  const close = () => !busy && setDialog(null);

  async function run() {
    if (!dialog) return;
    const text = comment.trim();
    if ((dialog === 'reject' || dialog === 'cancel') && text.length < 3) return setError(t(dialog === 'reject' ? 'quotations.commentRequired' : 'quotations.reasonRequired'));
    if (dialog === 'approve' && excessMessage && !confirmExcess) return setError(t('quotations.excessNeeded'));
    setBusy(true);
    setError(null);
    let result: { error: { message?: string } | null };
    if (dialog === 'submit') result = await supabase.rpc('submit_quotation_revision', { p_revision: q.latest_revision_id });
    else if (dialog === 'approve')
      result = await supabase.rpc('decide_quotation_revision', { p_revision: q.latest_revision_id, p_approve: true, p_comment: text || null, p_confirm_excess: !!excessMessage && confirmExcess });
    else if (dialog === 'reject') result = await supabase.rpc('decide_quotation_revision', { p_revision: q.latest_revision_id, p_approve: false, p_comment: text, p_confirm_excess: false });
    else if (dialog === 'revise') result = await supabase.rpc('new_quotation_revision', { p_quotation: q.quotation_id });
    else result = await supabase.rpc('cancel_quotation', { p_quotation: q.quotation_id, p_reason: text });
    setBusy(false);
    if (result.error) {
      const message = dbErrorText(result.error, t);
      if (dialog === 'approve' && message.startsWith(EXCESS_PREFIX)) {
        setExcessMessage(message);
        return;
      }
      return setError(message);
    }
    const finished = dialog;
    setDialog(null);
    onDone(t(`quotations.done.${finished}`), finished === 'revise');
  }

  const META: Record<Dialog, { title: string; body: string; submit: string; tone?: 'danger' }> = {
    submit: { title: t('quotations.submitTitle'), body: t('quotations.submitBody'), submit: t('quotations.submit') },
    approve: { title: t('quotations.approveTitle', { n: q.latest_revision }), body: t('quotations.approveBody'), submit: t('quotations.approve') },
    reject: { title: t('quotations.rejectTitle', { n: q.latest_revision }), body: t('quotations.rejectBody'), submit: t('quotations.reject'), tone: 'danger' },
    revise: { title: t('quotations.reviseTitle'), body: t('quotations.reviseBody'), submit: t('quotations.newRevision') },
    cancel: { title: t('quotations.cancelTitle'), body: t('quotations.cancelBody'), submit: t('quotations.cancel'), tone: 'danger' },
  };

  const hasAny = q.can_edit || q.can_submit || q.can_decide || q.can_new_revision || q.can_cancel;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {q.can_edit && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>{t('common.edit')}</Button>}
      {q.can_submit && <Button icon={<Send className="h-4 w-4" />} onClick={() => open('submit')}>{t('quotations.submit')}</Button>}
      {q.can_decide && <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => open('approve')}>{t('quotations.approve')}</Button>}
      {q.can_decide && <Button variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => open('reject')}>{t('quotations.reject')}</Button>}
      {q.can_new_revision && <Button variant="secondary" icon={<CopyPlus className="h-4 w-4" />} onClick={() => open('revise')}>{t('quotations.newRevision')}</Button>}
      {q.can_cancel && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => open('cancel')}>{t('quotations.cancel')}</Button>}

      {dialog && (
        <Modal open title={META[dialog].title} description={META[dialog].body} submitLabel={META[dialog].submit} submitTone={META[dialog].tone} busy={busy} onSubmit={run} onClose={close}>
          <div className="space-y-4">
            <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm">
              <p className="font-medium text-ink-900">{q.reference}</p>
              <p dir="auto" className="text-ink-600">{`${q.vendor_code} - ${q.vendor_name}`}</p>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            {(dialog === 'approve' || dialog === 'reject' || dialog === 'cancel') && (
              <Field label={t(dialog === 'cancel' ? 'quotations.field.reason' : 'quotations.field.comment')} optional={dialog === 'approve'}>
                {(id) => <TextArea id={id} dir="auto" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />}
              </Field>
            )}
            {dialog === 'approve' && excessMessage && (
              <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p>{excessMessage}</p>
                <label className="flex cursor-pointer items-center gap-3 font-semibold">
                  <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={confirmExcess} onChange={(e) => setConfirmExcess(e.target.checked)} />
                  {t('quotations.confirmExcess')}
                </label>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
