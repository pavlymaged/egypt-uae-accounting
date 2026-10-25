import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Card, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { ratePercent, storedRate } from './rates';

interface FeeRow {
  markup: string;
  on_income: string;
}

function isFeeRows(data: unknown): data is FeeRow[] {
  return Array.isArray(data) && data.every((r) => r && typeof r.markup === 'string' && typeof r.on_income === 'string');
}

function RateCell({ value }: { value: string }) {
  return (
    <span dir="ltr" className="inline-flex items-baseline gap-2 tabular-nums">
      <span className="font-medium text-ink-900">{ratePercent(value)}</span>
      <span className="text-xs text-ink-400">{storedRate(value)}</span>
    </span>
  );
}

export function FeeTableTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<FeeRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('fee_table')
      .select('markup:markup::text, on_income:on_income::text')
      .order('markup')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !isFeeRows(data)) setFailed(true);
        else setRows(data);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="space-y-4">
      <Alert tone="info">
        <p className="flex items-center gap-2 font-medium"><Lock className="h-3.5 w-3.5" />{t('ref.fees.readOnly')}</p>
        <p>{t('ref.fees.note')}</p>
      </Alert>

      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !rows && <Spinner label={t('common.loading')} />}

      {rows && (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3 text-sm text-ink-500">{t('ref.fees.count', { count: rows.length })}</div>
          <div className="max-w-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 text-start">{t('ref.fees.markup')}</th>
                  <th className="px-4 py-3 text-start">{t('ref.fees.onIncome')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.markup} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-2.5"><RateCell value={r.markup} /></td>
                    <td className="px-4 py-2.5"><RateCell value={r.on_income} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
