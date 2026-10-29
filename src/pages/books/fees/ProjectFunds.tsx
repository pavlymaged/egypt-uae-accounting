import { PiggyBank } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatAmount } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { FUNDS_COLUMNS, type FundsLine } from './feeCharges';

export function ProjectFunds({ companyId, projectCode, reloadKey }: { companyId: string; projectCode: string; reloadKey: number }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<FundsLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('project_funds')
      .select(FUNDS_COLUMNS)
      .eq('company_id', companyId)
      .eq('project_code', projectCode)
      .order('currency')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setLines(data as unknown as FundsLine[]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, projectCode, reloadKey, attempt]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <PiggyBank className="h-4 w-4 text-brand-700" />
        <h3 className="text-sm font-semibold text-ink-900">{t('funds.title')}</h3>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-ink-500">{t('funds.hint')}</p>
      {failed ? (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>{t('common.loadFailed')}</Alert>
      ) : !lines ? (
        <Spinner label={t('common.loading')} />
      ) : lines.length === 0 ? (
        <p className="text-sm text-ink-500">{t('funds.none')}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {lines.map((l) => (
            <li key={l.currency} dir="ltr" className="rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-2.5 text-base font-semibold tabular-nums text-ink-900">
              {formatAmount(l.funds_held, l.currency)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
