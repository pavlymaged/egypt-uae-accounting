import { LifeBuoy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaff } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { useSupportSession } from '../../support/SupportSessionProvider';
import { SUPPORT_COLUMNS, isSessionOpen, type SupportSession } from '../../types';

type Row = SupportSession & {
  staff: { full_name: string } | null;
  company: { name: string; code: string } | null;
};

type Status = 'open' | 'closed' | 'expired';

function statusOf(r: Row): Status {
  if (r.closed_at) return 'closed';
  return isSessionOpen(r) ? 'open' : 'expired';
}

const STATUS_TONE = { open: 'success', closed: 'neutral', expired: 'warning' } as const;

export function SupportSessionsPage() {
  const { t, lang } = useI18n();
  const staff = useStaff();
  const { active } = useSupportSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('support_sessions')
      .select(`${SUPPORT_COLUMNS}, staff:staff_members(full_name), company:companies(name, code)`)
      .order('opened_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setFailed(true);
        setRows((data ?? []) as unknown as Row[]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, active?.id, active?.mode]);

  const subtitle = staff?.staff_role === 'super_admin' ? t('supportList.subtitleAll') : t('supportList.subtitleOwn');

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('nav.support')} subtitle={subtitle} />

      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !rows && <Spinner label={t('common.loading')} />}

      {rows && rows.length === 0 && (
        <Card>
          <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title={t('supportList.empty')}>
            {t('supportList.emptyHint')}
          </EmptyState>
        </Card>
      )}

      {rows && rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-start text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('supportList.col.staff')}</th>
                  <th className="px-4 py-3 text-start">{t('supportList.col.company')}</th>
                  <th className="px-4 py-3 text-start">{t('supportList.col.reason')}</th>
                  <th className="px-4 py-3 text-start">{t('supportList.col.mode')}</th>
                  <th className="px-4 py-3 text-start">{t('supportList.col.opened')}</th>
                  <th className="px-4 py-3 text-start">{t('supportList.col.ends')}</th>
                  <th className="px-4 py-3 text-start">{t('supportList.col.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => {
                  const status = statusOf(r);
                  return (
                    <tr key={r.id} className="align-top transition-colors hover:bg-ink-50/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{r.staff?.full_name ?? t('common.notSet')}</td>
                      <td className="px-4 py-3">
                        <Link to={`/companies/${r.company_id}?tab=support`} className="text-brand-700 hover:underline">
                          {r.company?.name ?? t('common.notSet')}
                        </Link>
                        {r.company && <p dir="ltr" className="text-xs text-ink-500 rtl:text-end">{r.company.code}</p>}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-ink-700">
                        <p>{r.reason}</p>
                        {r.edit_reason && <p className="mt-1 text-xs text-amber-800">{t('supportList.editReason', { reason: r.edit_reason })}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge tone={r.mode === 'edit' ? 'warning' : 'sky'}>{t(`support.mode.${r.mode}`)}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-700">{formatDateTime(r.opened_at, lang)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-700">{formatDateTime(r.closed_at ?? r.expires_at, lang)}</td>
                      <td className="px-4 py-3"><Badge tone={STATUS_TONE[status]}>{t(`support.status.${status}`)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-ink-100 md:hidden">
            {rows.map((r) => {
              const status = statusOf(r);
              return (
                <li key={r.id} className="space-y-2 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{r.company?.name ?? t('common.notSet')}</p>
                    <Badge tone={STATUS_TONE[status]}>{t(`support.status.${status}`)}</Badge>
                    <Badge tone={r.mode === 'edit' ? 'warning' : 'sky'}>{t(`support.mode.${r.mode}`)}</Badge>
                  </div>
                  <p className="text-sm text-ink-700">{r.reason}</p>
                  <p className="text-xs text-ink-500">
                    {r.staff?.full_name ?? t('common.notSet')} · {formatDateTime(r.opened_at, lang)} → {formatDateTime(r.closed_at ?? r.expires_at, lang)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
