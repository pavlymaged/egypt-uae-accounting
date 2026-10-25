import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';

interface CostCentre { code: string; name_en: string; name_ar: string | null }
interface CodedName { code: string; name_en: string }
interface PaymentMethod { direction: 'out' | 'in'; name: string }

interface Lists {
  costCentres: CostCentre[];
  projectTypes: CodedName[];
  officeIncome: CodedName[];
  payments: PaymentMethod[];
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <Badge>{count}</Badge>
      </div>
      {children}
    </Card>
  );
}

function ArName({ value }: { value: string | null }) {
  return value ? <span dir="rtl" lang="ar">{value}</span> : <span className="text-ink-400">—</span>;
}

function SimpleList({ rows }: { rows: CodedName[] }) {
  return (
    <ul className="divide-y divide-ink-100 text-sm">
      {rows.map((r) => (
        <li key={r.code} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-ink-900">{r.name_en}</span>
          <code dir="ltr" className="rounded bg-ink-50 px-1.5 py-0.5 text-xs text-ink-500">{r.code}</code>
        </li>
      ))}
    </ul>
  );
}

export function OtherListsTab() {
  const { t } = useI18n();
  const [lists, setLists] = useState<Lists | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('cost_centres').select('code, name_en, name_ar'),
      supabase.from('project_types').select('code, name_en').order('name_en'),
      supabase.from('office_income_types').select('code, name_en').order('name_en'),
      supabase.from('legacy_payment_methods').select('direction, name').order('name'),
    ])
      .then(([cc, pt, oi, pm]) => {
        if (cancelled) return;
        if (cc.error || pt.error || oi.error || pm.error) {
          setFailed(true);
          return;
        }
        setLists({
          costCentres: (cc.data ?? []) as CostCentre[],
          projectTypes: (pt.data ?? []) as CodedName[],
          officeIncome: (oi.data ?? []) as CodedName[],
          payments: (pm.data ?? []) as PaymentMethod[],
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!lists) return <Spinner label={t('common.loading')} />;

  const groups = [
    { dir: 'out' as const, label: t('ref.other.moneyOut'), icon: <ArrowUpRight className="h-4 w-4 text-red-500" /> },
    { dir: 'in' as const, label: t('ref.other.moneyIn'), icon: <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title={t('ref.other.costCentres')} count={lists.costCentres.length}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
              <th className="px-4 py-2.5 text-start">{t('ref.col.code')}</th>
              <th className="px-4 py-2.5 text-start">{t('ref.col.nameEn')}</th>
              <th className="px-4 py-2.5 text-start">{t('ref.col.nameAr')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {lists.costCentres.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-2.5"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 font-semibold text-brand-800">{c.code}</span></td>
                <td className="px-4 py-2.5 text-ink-900">{c.name_en}</td>
                <td className="px-4 py-2.5 text-ink-700"><ArName value={c.name_ar} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('ref.other.paymentMethods')} count={lists.payments.length}>
        <div className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          {groups.map((g) => (
            <div key={g.dir}>
              <p className="flex items-center gap-2 px-4 pt-3 text-xs font-medium uppercase tracking-wide text-ink-500">{g.icon}{g.label}</p>
              <ul className="space-y-1 px-4 py-3 text-sm text-ink-900">
                {lists.payments.filter((p) => p.direction === g.dir).map((p) => (
                  <li key={p.name}>{p.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('ref.other.projectTypes')} count={lists.projectTypes.length}>
        <SimpleList rows={lists.projectTypes} />
      </Section>

      <Section title={t('ref.other.officeIncome')} count={lists.officeIncome.length}>
        <SimpleList rows={lists.officeIncome} />
      </Section>
    </div>
  );
}
