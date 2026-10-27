import { Pencil, Plus, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Toggle } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { ActiveBadge } from '../staff/StaffListPage';
import { CLIENT_COLUMNS, type BooksAccess, type Client } from './books';
import { ClientDialog } from './ClientDialog';
import { ListToolbar } from './ListToolbar';

export function ClientsPanel({ access }: { access: BooksAccess }) {
  const { t } = useI18n();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<{ client: Client | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('clients')
      .select(CLIENT_COLUMNS)
      .eq('company_id', access.companyId)
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setClients(data as Client[]);
      });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (clients ?? []).filter(
      (c) =>
        (showInactive || c.is_active) &&
        (!q || [c.name, c.phone ?? '', c.email ?? ''].some((v) => v.toLowerCase().includes(q))),
    );
  }, [clients, query, showInactive]);

  function onSaved() {
    setNotice(dialog?.client ? t('clients.saved') : t('clients.added'));
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
  if (!clients) return <Spinner label={t('common.loading')} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">{t('clients.intro')}</p>
        {access.canManageClients && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({ client: null })}>{t('clients.add')}</Button>
        )}
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('clients.search')}>
          <Toggle checked={showInactive} onChange={setShowInactive} label={t('clients.showInactive')} />
        </ListToolbar>
        {visible.length === 0 ? (
          <EmptyState icon={<UserRound className="h-6 w-6" />} title={clients.length === 0 ? t('clients.empty') : t('books.noMatch')} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
                    <th className="px-4 py-3 text-start">{t('clients.field.name')}</th>
                    <th className="px-4 py-3 text-start">{t('clients.field.phone')}</th>
                    <th className="px-4 py-3 text-start">{t('clients.field.email')}</th>
                    <th className="px-4 py-3 text-start">{t('books.col.status')}</th>
                    {access.canManageClients && <th className="px-4 py-3"><span className="sr-only">{t('common.edit')}</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {visible.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-ink-50/60">
                      <td className="px-4 py-3 font-medium text-ink-900">{c.name}</td>
                      <td className="px-4 py-3 text-ink-700" dir="ltr">{c.phone || <span className="text-ink-400">-</span>}</td>
                      <td className="px-4 py-3 text-ink-700" dir="ltr">{c.email || <span className="text-ink-400">-</span>}</td>
                      <td className="px-4 py-3"><ActiveBadge active={c.is_active} /></td>
                      {access.canManageClients && (
                        <td className="px-4 py-3 text-end">
                          <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog({ client: c })}>{t('common.edit')}</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">
              {visible.map((c) => (
                <li key={c.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink-900">{c.name}</p>
                      <ActiveBadge active={c.is_active} />
                    </div>
                    {c.phone && <p dir="ltr" className="text-sm text-ink-600 rtl:text-end">{c.phone}</p>}
                    {c.email && <p dir="ltr" className="text-sm text-ink-600 rtl:text-end">{c.email}</p>}
                  </div>
                  {access.canManageClients && (
                    <Button variant="ghost" aria-label={t('common.edit')} icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog({ client: c })} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <ClientDialog open={!!dialog} companyId={access.companyId} client={dialog?.client ?? null} onClose={() => setDialog(null)} onSaved={onSaved} />
    </div>
  );
}
