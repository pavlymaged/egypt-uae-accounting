import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Field, SelectInput, TextInput, Toggle } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, type Currency } from '../../types';
import { dbErrorText, fieldFromMessage, type CashAccount } from './books';

type CashField = 'name' | 'currency';

const PREFIXES: [string, CashField][] = [
  ['Account name:', 'name'],
  ['Currency:', 'currency'],
];

interface Props {
  open: boolean;
  companyId: string;
  defaultCurrency: Currency;
  account: CashAccount | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CashAccountDialog({ open, companyId, defaultCurrency, account, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: CashField | null; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setCurrency(account?.currency ?? defaultCurrency);
    setActive(account?.is_active ?? true);
    setError(null);
  }, [open, account, defaultCurrency]);

  async function save() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('save_cash_account', {
      p_company: companyId,
      p_id: account?.id ?? null,
      p_name: name.trim(),
      p_currency: currency,
      p_active: active,
    });
    setBusy(false);
    if (rpcError || typeof data !== 'string') {
      const text = dbErrorText(rpcError, t);
      return setError({ field: fieldFromMessage(text, PREFIXES), text });
    }
    onSaved();
  }

  const errorFor = (field: CashField) => (error?.field === field ? error.text : null);

  return (
    <Modal
      open={open}
      title={account ? t('cash.editTitle') : t('cash.addTitle')}
      description={account ? undefined : t('cash.addHint')}
      submitLabel={busy ? t('common.saving') : t('common.save')}
      busy={busy}
      onSubmit={save}
      onClose={onClose}
    >
      {error && !error.field && <Alert tone="error">{error.text}</Alert>}
      <Field label={t('cash.field.name')} error={errorFor('name')}>
        {(id, d, invalid) => <TextInput id={id} aria-describedby={d} invalid={invalid} value={name} maxLength={100} autoFocus onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label={t('cash.field.currency')} error={errorFor('currency')} hint={account ? t('cash.currencyFixed') : undefined}>
        {(id, d, invalid) => (
          <SelectInput id={id} aria-describedby={d} invalid={invalid} value={currency} disabled={!!account} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectInput>
        )}
      </Field>
      {account && <Toggle checked={active} onChange={setActive} label={t('common.active')} description={t('cash.activeHint')} />}
    </Modal>
  );
}
