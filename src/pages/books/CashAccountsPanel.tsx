import { ArrowLeftRight, Landmark, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { todayIn } from '../../lib/dates';
import { formatNumber } from '../../lib/money';
import { supabase } from '../../lib/supabase';
import { ActiveBadge } from '../staff/StaffListPage';
import { type BooksAccess, type CashAccount } from './books';
import { CashAccountDialog } from './CashAccountDialog';
import { TransferForm } from './transfers/TransferForm';
import { asCashAccount, BALANCE_COLUMNS, type BalanceAccount } from './transfers/transfers';

export function CashAccountsPanel({ access }: { access: BooksAccess }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<BalanceAccount[] | null>(null);
  const [today, setToday] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<{ account: CashAccount | null } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('cash_account_balances').select(BALANCE_COLUMNS).eq('company_id', access.companyId).order('is_system', { ascending: false }).order('name'),
      supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([list, company]) => {
      if (cancelled) return;
      if (list.error || company.error || !Array.isArray(list.data)) return setFailed(true);
      setRows(list.data as unknown as BalanceAccount[]);
      setToday(todayIn(company.data?.time_zone ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  function onSaved() {
    setNotice({ tone: 'success', text: dialog?.account ? t('cash.saved') : t('cash.added') });
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
  if (!rows) return <Spinner label={t('common.loading')} />;

  const accounts = rows.map(asCashAccount);
  const balances = new Map(rows.map((r) => [r.account_id, r.balance]));
  const rawBalance = (a: CashAccount) => String(balances.get(a.id) ?? '0').trim();
  const balanceOf = (a: CashAccount) => `${formatNumber(rawBalance(a), a.currency)} ${a.currency}`;
  const owesNote = (a: CashAccount) => a.kind === 'custody' && rawBalance(a).startsWith('-') && <p className="text-xs font-normal text-emerald-700">{t('cash.custodyOwes')}</p>;
  const canEdit = (a: CashAccount) => access.canManageSetup && a.kind === 'extra' && !a.is_system;
  const kindLabel = (a: CashAccount) => (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-ink-700">{t(`cash.kind.${a.kind}`)}</span>
      {a.is_system && <Badge tone="sky">{t('cash.automatic')}</Badge>}
      {a.kind === 'custody' && <Badge tone="gold">{t('cash.custodyBadge')}</Badge>}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">{t('cash.intro')}</p>
        <div className="flex flex-wrap gap-2">
          {access.canRecord && (
            <Button variant="secondary" icon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setTransferOpen(true)}>{t('transfers.add')}</Button>
          )}
          {access.canManageSetup && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ account: null })}>{t('cash.add')}</Button>
          )}
        </div>
      </div>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
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
                      <td className="whitespace-nowrap px-4 py-3 text-end font-medium tabular-nums text-ink-900"><span dir="ltr">{balanceOf(a)}</span>{owesNote(a)}</td>
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
                    {owesNote(a)}
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
      <TransferForm
        open={transferOpen}
        access={access}
        transfer={null}
        accounts={rows}
        today={today}
        onClose={() => setTransferOpen(false)}
        onChanged={() => setAttempt((a) => a + 1)}
        onDone={(text) => {
          setNotice({ tone: 'success', text });
          setTransferOpen(false);
          setAttempt((a) => a + 1);
        }}
      />
    </div>
  );
}
