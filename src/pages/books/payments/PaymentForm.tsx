import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Feedback';
import { Field, SelectInput, TextArea, TextInput } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useI18n } from '../../../i18n/I18nProvider';
import { toUnits } from '../../../lib/decimal';
import { normalizeAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, fieldFromMessage, type BooksAccess, type CashAccount, type Project } from '../books';
import { PaymentPreview } from './PaymentPreview';
import type { Payment } from './payments';

type PaymentField = 'project' | 'date' | 'account' | 'amount' | 'rate' | 'receivedBy' | 'notes' | 'link';

const PREFIXES: [string, PaymentField][] = [
  ['Project:', 'project'],
  ['Date:', 'date'],
  ['Receiving account:', 'account'],
  ['Currency:', 'account'],
  ['Amount:', 'amount'],
  ['Exchange rate:', 'rate'],
  ['Received by:', 'receivedBy'],
  ['Notes:', 'notes'],
  ['Receipt link:', 'link'],
];

type Next = 'none' | 'submit' | 'post';

interface Props {
  open: boolean;
  access: BooksAccess;
  payment: Payment | null;
  projects: Project[];
  accounts: CashAccount[];
  today: string;
  onClose: () => void;
  onChanged: () => void;
  onDone: (message: string) => void;
}

export function PaymentForm({ open, access, payment, projects, accounts, today, onClose, onChanged, onDone }: Props) {
  const { t } = useI18n();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<Next | null>(null);
  const [error, setError] = useState<{ field: PaymentField | null; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntryId(payment?.entry_id ?? null);
    setProjectId(payment?.project_id ?? '');
    setDate(payment?.entry_date ?? today);
    setAccountId(payment?.account_id ?? '');
    setAmount(payment?.amount ?? '');
    setRate(payment && payment.currency !== access.currency ? payment.rate : '');
    setReceivedBy(payment?.received_by ?? '');
    setNotes(payment?.notes ?? '');
    setLink(payment?.receipt_link ?? '');
    setError(null);
    setBusy(null);
  }, [open, payment, today, access.currency]);

  const projectOptions = useMemo(
    () => projects.filter((p) => !p.is_operation && (p.is_active || p.id === payment?.project_id)),
    [projects, payment],
  );
  const accountOptions = useMemo(
    () => accounts.filter((a) => a.kind !== 'custody' && (a.is_active || a.id === payment?.account_id)),
    [accounts, payment],
  );
  const project = projectOptions.find((p) => p.id === projectId) ?? null;
  const account = accountOptions.find((a) => a.id === accountId) ?? null;
  const currency = account?.currency ?? null;
  const needsRate = !!currency && currency !== access.currency;
  const amountText = normalizeAmount(amount);
  const rateText = needsRate ? normalizeAmount(rate) : null;
  const secondStep: Next = access.selfService ? (access.canPost ? 'post' : 'none') : 'submit';

  async function save(next: Next) {
    if (amountText && toUnits(amountText, 20) === null) return setError({ field: 'amount', text: t('payments.err.number') });
    if (rateText && toUnits(rateText, 20) === null) return setError({ field: 'rate', text: t('payments.err.number') });
    setBusy(next);
    setError(null);
    const { data, error: saveError } = await supabase.rpc('save_client_payment', {
      p_company: access.companyId,
      p_entry: entryId,
      p_project: projectId || null,
      p_date: date || null,
      p_amount: amountText || null,
      p_currency: currency,
      p_rate: rateText || null,
      p_account: accountId || null,
      p_received_by: receivedBy.trim(),
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
    onDone(t(next === 'submit' ? 'payments.done.submitted' : 'payments.done.posted'));
  }

  const errorFor = (field: PaymentField) => (error?.field === field ? error.text : null);

  return (
    <Modal
      open={open}
      wide
      title={entryId ? t('payments.editTitle') : t('payments.addTitle')}
      description={t('payments.formHint')}
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
      {payment?.status === 'rejected' && payment.reject_comment && (
        <Alert tone="warning">{t('payments.returnedWith', { comment: payment.reject_comment })}</Alert>
      )}
      {error && !error.field && <Alert tone="error">{error.text}</Alert>}

      <Field label={t('payments.field.project')} error={errorFor('project')} hint={projectOptions.length === 0 ? t('payments.noProjects') : undefined}>
        {(id, d, invalid) => (
          <SelectInput id={id} aria-describedby={d} invalid={invalid} value={projectId} autoFocus onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('payments.chooseProject')}</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{`${p.code} - ${p.name}`}</option>
            ))}
          </SelectInput>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('payments.field.date')} error={errorFor('date')}>
          {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={t('payments.field.receivedBy')} optional error={errorFor('receivedBy')}>
          {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} value={receivedBy} maxLength={200} onChange={(e) => setReceivedBy(e.target.value)} />}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <Field label={t('payments.field.account')} error={errorFor('account')} hint={accountOptions.length === 0 ? t('payments.noAccounts') : undefined}>
          {(id, d, invalid) => (
            <SelectInput id={id} aria-describedby={d} invalid={invalid} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{t('payments.chooseAccount')}</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{`${a.name} (${a.currency})`}</option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t('payments.field.currency')} hint={t('payments.currencyHint')}>
          {(id, d) => <TextInput id={id} aria-describedby={d} readOnly dir="ltr" className="sm:w-28" value={currency ?? '-'} />}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('payments.field.amount')} error={errorFor('amount')}>
          {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} inputMode="decimal" dir="ltr" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        {needsRate && currency && (
          <Field label={t('payments.field.rate')} error={errorFor('rate')} hint={t('payments.rateHint', { currency, base: access.currency })}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} inputMode="decimal" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} />}
          </Field>
        )}
      </div>

      <PaymentPreview
        companyId={access.companyId}
        projectId={projectId}
        feeMethod={project?.fee_method ?? null}
        amount={amountText}
        currency={currency}
        rate={rateText}
        baseCurrency={access.currency}
      />
      <p className="text-xs leading-relaxed text-ink-500">{t('payments.feeExplain')}</p>

      <Field label={t('payments.field.link')} optional error={errorFor('link')}>
        {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} type="url" dir="ltr" value={link} placeholder="https://" onChange={(e) => setLink(e.target.value)} />}
      </Field>
      <Field label={t('payments.field.notes')} optional error={errorFor('notes')}>
        {(id, d, invalid) => <TextArea id={id} aria-describedby={d} invalid={invalid} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </Modal>
  );
}
