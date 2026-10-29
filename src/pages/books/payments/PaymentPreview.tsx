import { Calculator } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { toUnits } from '../../../lib/decimal';
import { formatNumber } from '../../../lib/money';
import { ratePercent } from '../../../lib/rates';
import { supabase } from '../../../lib/supabase';
import type { Currency } from '../../../types';
import { dbErrorText, type FeeMethod } from '../books';
import { subtractText } from '../entries/entries';
import { PREVIEW_COLUMNS, type Preview } from './payments';

interface Input {
  companyId: string;
  projectId: string;
  feeMethod: FeeMethod | null;
  amount: string;
  currency: Currency | null;
  rate: string | null;
  baseCurrency: Currency;
}

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; preview: Preview; amount: string } | { kind: 'error'; message: string };

const isNumberText = (v: string) => toUnits(v, 20) !== null;

export function PaymentPreview({ companyId, projectId, feeMethod, amount, currency, rate, baseCurrency }: Input) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const ready = !!projectId && !!currency && amount !== '' && isNumberText(amount) && (rate === null || (rate !== '' && isNumberText(rate)));

  useEffect(() => {
    if (!ready || !currency) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setState({ kind: 'loading' });
      const { data, error } = await supabase
        .rpc('preview_client_payment', { p_company: companyId, p_project: projectId, p_amount: amount, p_currency: currency, p_rate: rate })
        .select(PREVIEW_COLUMNS);
      if (cancelled) return;
      const row = Array.isArray(data) ? (data[0] as unknown as Preview | undefined) : undefined;
      if (error || !row) return setState({ kind: 'error', message: dbErrorText(error, t) });
      setState({ kind: 'ready', preview: row, amount });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, companyId, projectId, amount, currency, rate, t]);

  if (state.kind === 'idle') return null;
  if (state.kind === 'loading') return <div className="rounded-xl border border-ink-200 p-3"><Spinner label={t('payments.preview.loading')} /></div>;
  if (state.kind === 'error') return <p role="status" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p>;
  if (!currency) return null;

  const { preview } = state;
  const net = subtractText(state.amount, preview.fee_amount);
  return (
    <div role="status" className="animate-fade-in rounded-xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-800">
        <Calculator className="h-4 w-4" />
        {t('payments.preview.title')}
      </p>
      <dl className="space-y-1.5 text-sm">
        {currency !== baseCurrency && (
          <Line label={t('payments.preview.base', { currency: baseCurrency })} value={formatNumber(preview.base_amount, baseCurrency)} />
        )}
        {feeMethod === 'percent' ? (
          <>
            <Line label={t('payments.preview.feeRate')} value={t('payments.preview.feeRateValue', { rate: ratePercent(preview.fee_rate) })} />
            <Line label={t('payments.preview.fee')} value={`${formatNumber(preview.fee_amount, currency)} ${currency}`} />
            {net !== null && <Line strong label={t('payments.preview.net')} value={`${formatNumber(net, currency)} ${currency}`} />}
          </>
        ) : (
          <p className="text-ink-700">{t('payments.preview.noFee')}</p>
        )}
      </dl>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <dt className="text-ink-600">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-ink-900' : 'text-ink-800'}`}><span dir="ltr">{value}</span></dd>
    </div>
  );
}
