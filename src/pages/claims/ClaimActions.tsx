import { CheckCheck, CheckCircle2, RotateCcw, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { dbErrorText } from '../books/books';
import type { SiteClaim } from './claims';
import { ReasonDialog } from './ClaimParts';

type Dialog = 'return' | 'reverse' | null;

export function hasClaimActions(c: SiteClaim): boolean {
  return c.can_preapprove || c.can_approve || c.can_reject || (c.can_reverse && !!c.entry_id);
}

export function ClaimActions({ claim: c, onDone, onError }: { claim: SiteClaim; onDone: (text: string) => void; onError: (text: string) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const decide = async (fn: 'preapprove_site_claim' | 'approve_site_claim', doneText: string) => {
    setBusy(fn);
    const { error } = await supabase.rpc(fn, { p_claim: c.claim_id });
    setBusy(null);
    if (error) onError(dbErrorText(error, t));
    else onDone(doneText);
  };

  const submitReason = async (text: string) => {
    setBusy(dialog);
    setDialogError(null);
    const { error } =
      dialog === 'return'
        ? await supabase.rpc('reject_site_claim', { p_claim: c.claim_id, p_comment: text })
        : await supabase.rpc('reverse_entry', { p_entry: c.entry_id, p_reason: text });
    setBusy(null);
    if (error) return setDialogError(dbErrorText(error, t));
    const doneText = dialog === 'return' ? t('claims.done.returned') : t('claims.done.reversed');
    setDialog(null);
    onDone(doneText);
  };

  const open = (d: Dialog) => {
    setDialogError(null);
    setDialog(d);
  };

  return (
    <>
      {c.can_preapprove && (
        <Button variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} loading={busy === 'preapprove_site_claim'} disabled={!!busy} onClick={() => decide('preapprove_site_claim', t('claims.done.preapproved'))}>
          {t('claims.preapprove')}
        </Button>
      )}
      {c.can_approve && (
        <Button variant="primary" icon={<CheckCheck className="h-4 w-4" />} loading={busy === 'approve_site_claim'} disabled={!!busy} onClick={() => decide('approve_site_claim', t('claims.done.approved'))}>
          {t('claims.approve')}
        </Button>
      )}
      {c.can_reject && (
        <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} disabled={!!busy} onClick={() => open('return')}>
          {t('claims.return')}
        </Button>
      )}
      {c.can_reverse && c.entry_id && (
        <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} disabled={!!busy} onClick={() => open('reverse')}>
          {t('claims.reverse')}
        </Button>
      )}
      <ReasonDialog
        open={dialog !== null}
        title={dialog === 'reverse' ? t('claims.reverseTitle') : t('claims.returnTitle')}
        hint={dialog === 'reverse' ? t('claims.reverseHint') : t('claims.returnHint')}
        label={dialog === 'reverse' ? t('claims.reason') : t('claims.comment')}
        minLength={dialog === 'reverse' ? 5 : 3}
        submitLabel={dialog === 'reverse' ? t('claims.reverse') : t('claims.return')}
        tone={dialog === 'reverse' ? 'danger' : 'primary'}
        busy={busy === 'return' || busy === 'reverse'}
        error={dialogError}
        onSubmit={submitReason}
        onClose={() => !busy && setDialog(null)}
      />
    </>
  );
}
