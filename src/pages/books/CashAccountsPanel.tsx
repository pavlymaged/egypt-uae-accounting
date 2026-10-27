import { Landmark, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { formatNumber } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { ActiveBadge } from '../staff/StaffListPage';
import { CASH_COLUMNS, type BooksAccess, type CashAccount } from './books';
import { CashAccountDialog } from './CashAccountDialog';

interface BalanceRow {
  account_key: string;
  currency: string;
  net_amount: string | null;
}

const balanceKey = (accountKey: string, currency: string) => `${accountKey}|${currency}`;

export function CashAccountsPanel({ access }: { access: BooksAccess }) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<CashAccount[] | null>(null);
  const [balances, setBalances] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<{ account: CashAccount | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('cash_accounts').select(CASH_COLUMNS).eq('company_id', access.companyId).order('is_system', { ascending: false }).order('name'),
      supabase.from('ledger_balances').select('account_key, currency, net_amount:net_amount::text').eq('company_id', access.companyId).like('account_key', 'CASH:%'),
    ]).then(([list, ledger]) => {
      if (cancelled) return;
      if (list.error || ledger.error || !Array.isArray(list.data) || !Array.isArray(ledger.data)) return setFailed(true);
      setBalances(new Map((ledger.data as unknown as BalanceRow[]).map((b) => [balanceKey(b.account_key, b.currency), b.net_amount ?? '0'])));
      setAccounts(list.data as CashAccount[]);
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  function onSaved() {
    setNotice(dialog?.account ? t('cash.saved') : t('cash.added'));
    setDialog(null);
    setAttempt((a) => a + 1);
  }

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!accounts) return <Spinner label={t('common.loading')} />;

  const balanceOf = (a: CashAccount) => `${formatNumber(balances.get(balanceKey(`CASH:${a.code}`, a.currency)) ?? '0', a.currency)} ${a.currency}`;
  const canEdit = (a: CashAccount) => access.canManageSetup && a.kind === 'extra' && !a.is_system;
  const kindLabel = (a: CashAccount) => (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-ink-700">{t(`cash.kind.${a.kind}`)}</span>
      {a.is_system && <Badge tone="sky">{t('cash.automatic')}</Badge>}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">{t('cash.intro')}</p>
        {access.canManageSetup && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ account: null })}>{t('cash.add')}</Button>
        )}
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      <Card>
        {accounts.length === 0 ? (
          <EmptyState icon={<Landmark className="h-6 w-6" />} title={t('cash.empty')} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3 text-start">{t('cash.field.name')}</th>
                    <th className="px-4 py-3 text-start">{t('cash.col.code')}</th>
                    <th className="px-4 py-3 text-start">{t('cash.col.kind')}</th>
                    <th className="px-4 py-3 text-start">{t('cash.field.currency')}</th>
                    <th className="px-4 py-3 text-start">{t('books.col.status')}</th>
                    <th className="px-4 py-3 text-end">{t('cash.col.balance')}</th>
                    {access.canManageSetup && <th className="px-4 py-3"><span className="sr-only">{t('common.edit')}</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {accounts.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-ink-50/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{a.name}</td>
                      <td className="px-4 py-3"><span dir="ltr" className="font-mono text-xs text-ink-600">{a.code}</span></td>
                      <td className="px-4 py-3">{kindLabel(a)}</td>
                      <td className="px-4 py-3 text-ink-700">{a.currency}</td>
                      <td className="px-4 py-3"><ActiveBadge active={a.is_active} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-end font-medium tabular-nums text-ink-900"><span dir="ltr">{balanceOf(a)}</span></td>
                      {access.canManageSetup && (
                        <td className="px-4 py-3 text-end">
                          {canEdit(a) && <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog({ account: a })}>{t('common.edit')}</Button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{a.name}</p>
                      <ActiveBadge active={a.is_active} />
                    </div>
                    <div className="text-sm">{kindLabel(a)}</div>
                    <p className="text-sm font-medium tabular-nums text-ink-900"><span dir="ltr">{balanceOf(a)}</span></p>
                  </div>
                  {canEdit(a) && <Button variant="ghost" aria-label={t('common.edit')} icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog({ account: a })} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <CashAccountDialog
        open={!!dialog}
        companyId={access.companyId}
        defaultCurrency={access.currency}
        account={dialog?.account ?? null}
        onClose={() => setDialog(null)}
        onSaved={onSaved}
      />
    </div>
  );
}
