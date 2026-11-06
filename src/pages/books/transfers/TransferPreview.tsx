import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import type { Currency } from '../../../types';
import { dbErrorText } from '../books';
import { isZeroText } from '../entries/entries';
import { absText, isNegativeText, money, PREVIEW_COLUMNS, type TransferPreviewRow, type TransferType } from './transfers';

export interface PreviewInput {
  companyId: string;
  type: TransferType;
  fromId: string;
  toId: string;
  amountOut: string;
  rateOut: string | null;
  amountIn: string | null;
  rateIn: string | null;
}

export type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; row: TransferPreviewRow }
  | { kind: 'error'; message: string };

// Each input change cancels the pending call, so answers to older inputs are dropped.
export function useTransferPreview(input: PreviewInput | null): PreviewState {
  const { t } = useI18n();
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const key = input ? JSON.stringify(input) : '';

  useEffect(() => {
    if (!key) {
      setState({ kind: 'idle' });
      return;
    }
    const input = JSON.parse(key) as PreviewInput;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setState({ kind: 'loading' });
      const { data, error } = await supabase
        .rpc('preview_account_transfer', {
          p_company: input.companyId,
          p_type: input.type,
          p_from: input.fromId,
          p_to: input.toId,
          p_amount_out: input.amountOut,
          p_rate_out: input.rateOut,
          p_amount_in: input.amountIn,
          p_rate_in: input.rateIn,
        })
        .select(PREVIEW_COLUMNS);
      if (cancelled) return;
      const row = Array.isArray(data) ? (data[0] as unknown as TransferPreviewRow | undefined) : undefined;
      if (error || !row) return setState({ kind: 'error', message: dbErrorText(error, t) });
      if (row.error) return setState({ kind: 'error', message: row.error });
      setState({ kind: 'ready', row });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, t]);

  return state;
}

export function TransferPreviewBox({ state, type, baseCurrency }: { state: PreviewState; type: TransferType; baseCurrency: Currency }) {
  const { t } = useI18n();
  if (state.kind === 'idle') return null;
  if (state.kind === 'loading') return <div className="rounded-xl border border-ink-200 p-3"><Spinner label={t('payments.preview.loading')} /></div>;
  if (state.kind === 'error') return <p role="status" dir="auto" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p>;

  const r = state.row;
  const curOut = r.currency_out ?? baseCurrency;
  const curIn = r.currency_in ?? baseCurrency;
  const fx = r.fx_difference;
  return (
    <div role="status" className="animate-fade-in space-y-1.5 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-800">
        <ArrowLeftRight className="h-4 w-4" />
        {t('payments.preview.title')}
      </p>
      <Line text={t('transfers.preview.leaves', { amount: money(r.amount_out, curOut), base: money(r.base_out, baseCurrency) })} />
      <Line text={t('transfers.preview.arrives', { amount: money(r.amount_in, curIn), base: money(r.base_in, baseCurrency) })} />
      {fx !== null && !isZeroText(fx) && (
        <Line strong text={t(isNegativeText(fx) ? 'transfers.fxLoss' : 'transfers.fxGain', { amount: money(absText(fx), baseCurrency) })} />
      )}
      <Line text={t('transfers.preview.holds', { balance: money(r.source_balance, curOut) })} />
      {type === 'reimbursement' && <Line text={t('transfers.preview.owed', { owed: money(r.owed, curIn) })} />}
    </div>
  );
}

function Line({ text, strong }: { text: string; strong?: boolean }) {
  return <p dir="auto" className={`tabular-nums ${strong ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>{text}</p>;
}
