import { Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import { CustodyBalance } from '../ClaimParts';
import { CUSTODY_COLUMNS, type Custody } from '../claims';
import { EngineerScreen } from './EngineerScreen';

export function MyCustodyPage() {
  const { t } = useI18n();
  return <EngineerScreen title={t('nav.myCustody')} subtitle={t('custody.subtitle')}>{(c) => <CustodyCard companyId={c.companyId} />}</EngineerScreen>;
}

function CustodyCard({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Custody[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .rpc('my_custody')
      .select(CUSTODY_COLUMNS)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setRows((data as unknown as Custody[]).filter((r) => r.company_id === companyId));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, attempt]);

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!rows) return <Spinner label={t('common.loading')} />;
  if (rows.length === 0) return <Card><EmptyState icon={<Wallet className="h-6 w-6" />} title={t('custody.none')} /></Card>;

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <Card key={r.account_id} className="overflow-hidden">
          <div className="flex items-start gap-4 px-6 py-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Wallet className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <CustodyBalance balance={r.balance} currency={r.currency} view="engineer" size="lg" />
              <p className="mt-4 text-xs text-ink-500">
                {t('custody.account')}: <span className="font-medium text-ink-700">{r.account_name}</span> · {r.currency}
              </p>
            </div>
          </div>
          <p className="border-t border-ink-100 bg-ink-50/60 px-6 py-4 text-sm text-ink-600">{t('custody.explain')}</p>
        </Card>
      ))}
    </div>
  );
}
