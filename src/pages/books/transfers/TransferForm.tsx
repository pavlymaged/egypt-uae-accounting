import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { toUnits } from '../../../lib/decimal';
import { normalizeAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, fieldFromMessage, type BooksAccess } from '../books';
import { TransferPreviewBox, useTransferPreview, type PreviewInput } from './TransferPreview';
import {
  absText,
  isNegativeText,
  isTransferType,
  money,
  sideAllows,
  TRANSFER_TYPES,
  TYPE_HINT,
  TYPE_LABEL,
  type BalanceAccount,
  type Transfer,
  type TransferType,
} from './transfers';

type TransferField = 'type' | 'date' | 'from' | 'to' | 'amountOut' | 'rateOut' | 'amountIn' | 'rateIn' | 'notes' | 'link';

const PREFIXES: [string, TransferField][] = [
  ['Type:', 'type'],
  ['Date:', 'date'],
  ['From account:', 'from'],
  ['To account:', 'to'],
  ['Money going out:', 'amountOut'],
  ['Amount received:', 'amountIn'],
  ['Money coming in:', 'amountIn'],
  ['Notes:', 'notes'],
  ['Receipt link:', 'link'],
];

type Next = 'none' | 'submit' | 'post';

interface Props {
  open: boolean;
  access: BooksAccess;
  transfer: Transfer | null;
  accounts: BalanceAccount[];
  today: string;
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string) => void;
}

const isNumberText = (v: string) => v !== '' && toUnits(v, 20) !== null;

export function TransferForm({ open, access, transfer, accounts, today, onClose, onChanged, onDone }: Props) {
  const { t } = useI18n();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [type, setType] = useState<TransferType | ''>('');
  const [date, setDate] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [rateOut, setRateOut] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [rateIn, setRateIn] = useState('');
  const [confirmOverdraw, setConfirmOverdraw] = useState(false);
  const [confirmOverOwed, setConfirmOverOwed] = useState(false);
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<Next | null>(null);
  const [error, setError] = useState<{ field: TransferField | null; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const tr = transfer;
    const differs = !!tr && tr.currency_out !== tr.currency_in;
    setEntryId(tr?.entry_id ?? null);
    setType(tr && isTransferType(tr.transfer_type) ? tr.transfer_type : '');
    setDate(tr?.entry_date ?? today);
    setFromId(tr?.from_account_id ?? '');
    setToId(tr?.to_account_id ?? '');
    setAmountOut(tr?.amount_out ?? '');
    setRateOut(tr && tr.currency_out !== access.currency ? tr.rate_out : '');
    setAmountIn(differs ? tr.amount_in : '');
    setRateIn(differs && tr.currency_in !== access.currency ? tr.rate_in : '');
    setConfirmOverdraw(tr?.confirm_overdraw ?? false);
    setConfirmOverOwed(tr?.confirm_over_owed ?? false);
    setNotes(tr?.notes ?? '');
    setLink(tr?.receipt_link ?? '');
    setError(null);
    setBusy(null);
  }, [open, transfer, today, access.currency]);

  const savedFrom = transfer?.from_account_id;
  const savedTo = transfer?.to_account_id;
  const fromOptions = useMemo(
    () => accounts.filter((a) => sideAllows(type, 'from', a.kind) && (a.is_active || a.account_id === savedFrom)),
    [accounts, type, savedFrom],
  );
  const toOptions = useMemo(
    () => accounts.filter((a) => sideAllows(type, 'to', a.kind) && (a.is_active || a.account_id === savedTo) && a.account_id !== fromId),
    [accounts, type, savedTo, fromId],
  );

  const from = fromOptions.find((a) => a.account_id === fromId) ?? null;
  const to = toOptions.find((a) => a.account_id === toId) ?? null;
  const needsRateOut = !!from && from.currency !== access.currency;
  const differs = !!from && !!to && from.currency !== to.currency;
  const needsRateIn = differs && !!to && to.currency !== access.currency;

  const outText = normalizeAmount(amountOut);
  const rateOutText = needsRateOut ? normalizeAmount(rateOut) : '';
  const inText = differs ? normalizeAmount(amountIn) : '';
  const rateInText = needsRateIn ? normalizeAmount(rateIn) : '';

  const previewInput: PreviewInput | null =
    type && from && to && isNumberText(outText) && (!needsRateOut || isNumberText(rateOutText)) && (!differs || isNumberText(inText)) && (!needsRateIn || isNumberText(rateInText))
      ? {
          companyId: access.companyId,
          type,
          fromId: from.account_id,
          toId: to.account_id,
          amountOut: outText,
          rateOut: rateOutText || null,
          amountIn: inText || null,
          rateIn: rateInText || null,
        }
      : null;
  const preview = useTransferPreview(previewInput);
  const needsOverdraw = preview.kind === 'ready' && preview.row.needs_overdraw_confirmation;
  const needsOverOwed = preview.kind === 'ready' && preview.row.needs_over_owed_confirmation;
  const secondStep: Next = access.selfService ? (access.canPost ? 'post' : 'none') : 'submit';

  function chooseType(next: TransferType) {
    setType(next);
    const keep = (id: string, side: 'from' | 'to') => {
      const a = accounts.find((x) => x.account_id === id);
      return a && sideAllows(next, side, a.kind) ? id : '';
    };
    setFromId((id) => keep(id, 'from'));
    setToId((id) => keep(id, 'to'));
  }

  function accountLabel(a: BalanceAccount) {
    const head = `${a.name} (${a.currency})`;
    if (a.kind !== 'custody') return `${head} - ${money(a.balance, a.currency)}`;
    if (isNegativeText(a.balance)) return `${head} - ${t('transfers.option.owed', { amount: money(absText(a.balance), a.currency) })}`;
    return `${head} - ${t('transfers.option.holds', { amount: money(a.balance, a.currency) })}`;
  }

  async function save(next: Next) {
    const checks: [TransferField, string][] = [['amountOut', outText], ['rateOut', rateOutText], ['amountIn', inText], ['rateIn', rateInText]];
    const bad = checks.find(([, v]) => v !== '' && toUnits(v, 20) === null);
    if (bad) return setError({ field: bad[0], text: t('payments.err.number') });
    if (fromId && fromId === toId) return setError({ field: 'to', text: t('transfers.err.same') });
    setBusy(next);
    setError(null);
    const { data, error: saveError } = await supabase.rpc('save_account_transfer', {
      p_company: access.companyId,
      p_entry: entryId,
      p_type: type || null,
      p_date: date || null,
      p_from: fromId || null,
      p_to: toId || null,
      p_amount_out: outText || null,
      p_rate_out: rateOutText || null,
      p_amount_in: inText || null,
      p_rate_in: rateInText || null,
      p_confirm_overdraw: needsOverdraw && confirmOverdraw,
      p_confirm_over_owed: needsOverOwed && confirmOverOwed,
      p_notes: notes.trim(),
      p_receipt_link: link.trim(),
    });
    if (saveError || typeof data !== 'string') {
      setBusy(null);
      const text = dbErrorText(saveError, t);
      return setError({ field: fieldFromMessage(text, PREFIXES), text });
    }
    if (next === 'none') {
      setBusy(null);
      return onDone(t('payments.savedDraft'));
    }
    const { error: nextError } = await supabase.rpc(next === 'submit' ? 'submit_entry' : 'post_entry', { p_entry: data });
    setBusy(null);
    if (nextError) {
      setEntryId(data);
      onChanged();
      return setError({ field: null, text: t('payments.nextRefused', { message: dbErrorText(nextError, t) }) });
    }
    onDone(t(next === 'submit' ? 'transfers.done.submitted' : 'transfers.done.posted'));
  }

  const errorFor = (field: TransferField) => (error?.field === field ? error.text : null);
  const numberInput = (value: string, set: (v: string) => void) => (id: string, d: string | undefined, invalid: boolean) => (
    <TextInput id={id} aria-describedby={d} invalid={invalid} inputMode="decimal" dir="ltr" value={value} placeholder="0.00" onChange={(e) => set(e.target.value)} />
  );

  return (
    <Modal
      open={open}
      wide
      title={entryId ? t('transfers.editTitle') : t('transfers.addTitle')}
      description={t('transfers.formHint')}
      submitLabel={busy === 'none' ? t('common.saving') : t('payments.saveDraft')}
      busy={busy !== null}
      onSubmit={() => save('none')}
      onClose={onClose}
      extraActions={
        secondStep !== 'none' && (
          <Button type="button" loading={busy === secondStep} disabled={busy !== null} onClick={() => save(secondStep)}>
            {secondStep === 'submit' ? t('payments.saveSubmit') : t('payments.savePost')}
          </Button>
        )
      }
    >
      {transfer?.status === 'rejected' && transfer.reject_comment && (
        <Alert tone="warning">{t('payments.returnedWith', { comment: transfer.reject_comment })}</Alert>
      )}
      {error && !error.field && <Alert tone="error">{error.text}</Alert>}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink-800">{t('transfers.field.type')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRANSFER_TYPES.map((k) => {
            const selected = type === k;
            return (
              <label
                key={k}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${selected ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'}`}
              >
                <input type="radio" name="transfer-type" className="mt-1 accent-brand-700" checked={selected} onChange={() => chooseType(k)} />
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold text-ink-900">{t(TYPE_LABEL[k])}</span>
                  <span className="block text-xs leading-relaxed text-ink-600">{t(TYPE_HINT[k])}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errorFor('type') && <p className="text-sm text-red-700">{errorFor('type')}</p>}
      </fieldset>

      <Field label={t('payments.field.date')} error={errorFor('date')}>
        {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} type="date" dir="ltr" className="sm:w-48" value={date} onChange={(e) => setDate(e.target.value)} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('transfers.field.from')} error={errorFor('from')} hint={!type ? t('transfers.chooseTypeFirst') : fromOptions.length === 0 ? t('transfers.noAccounts') : undefined}>
          {(id, d, invalid) => (
            <SelectInput id={id} aria-describedby={d} invalid={invalid} value={fromId} disabled={!type} onChange={(e) => setFromId(e.target.value)}>
              <option value="">{t('payments.chooseAccount')}</option>
              {fromOptions.map((a) => (
                <option key={a.account_id} value={a.account_id}>{accountLabel(a)}</option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t('transfers.field.to')} error={errorFor('to')} hint={type && toOptions.length === 0 ? t('transfers.noAccounts') : undefined}>
          {(id, d, invalid) => (
            <SelectInput id={id} aria-describedby={d} invalid={invalid} value={to ? toId : ''} disabled={!type} onChange={(e) => setToId(e.target.value)}>
              <option value="">{t('payments.chooseAccount')}</option>
              {toOptions.map((a) => (
                <option key={a.account_id} value={a.account_id}>{accountLabel(a)}</option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={from ? t('transfers.field.amountOutIn', { currency: from.currency }) : t('transfers.field.amountOut')} error={errorFor('amountOut')}>
          {numberInput(amountOut, setAmountOut)}
        </Field>
        {needsRateOut && from && (
          <Field label={t('transfers.field.rateOut')} error={errorFor('rateOut')} hint={t('payments.rateHint', { currency: from.currency, base: access.currency })}>
            {numberInput(rateOut, setRateOut)}
          </Field>
        )}
      </div>

      {from && to && !differs && <p className="rounded-lg bg-ink-50 px-4 py-2.5 text-sm text-ink-700">{t('transfers.sameCurrency')}</p>}
      {differs && to && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('transfers.field.amountInIn', { currency: to.currency })} error={errorFor('amountIn')}>
            {numberInput(amountIn, setAmountIn)}
          </Field>
          {needsRateIn && (
            <Field label={t('transfers.field.rateIn')} error={errorFor('rateIn')} hint={t('payments.rateHint', { currency: to.currency, base: access.currency })}>
              {numberInput(rateIn, setRateIn)}
            </Field>
          )}
        </div>
      )}

      {type && <TransferPreviewBox state={preview} type={type} baseCurrency={access.currency} />}

      {needsOverdraw && (
        <Check checked={confirmOverdraw} onChange={setConfirmOverdraw} label={t('transfers.confirmOverdraw')} hint={t('transfers.confirmOverdrawHint')} />
      )}
      {needsOverOwed && (
        <Check checked={confirmOverOwed} onChange={setConfirmOverOwed} label={t('transfers.confirmOverOwed')} hint={t('transfers.confirmOverOwedHint')} />
      )}

      <Field label={t('payments.field.link')} optional error={errorFor('link')}>
        {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} type="url" dir="ltr" value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} />}
      </Field>
      <Field label={t('payments.field.notes')} optional error={errorFor('notes')}>
        {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </Modal>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="space-y-0.5">
        <span className="block font-semibold text-amber-900">{label}</span>
        <span className="block text-amber-800">{hint}</span>
      </span>
    </label>
  );
}
