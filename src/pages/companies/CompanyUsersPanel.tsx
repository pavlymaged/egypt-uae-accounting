import { Pencil, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import { COMPANY_USER_COLUMNS, PERMISSIONS, type Company, type CompanyUser } from '../../types';
import { ActiveBadge } from '../staff/StaffListPage';
import { CompanyUserDialog } from './CompanyUserDialog';

interface Props {
  company: Pick<Company, 'id' | 'service_model' | 'status'>;
  asAdmin: boolean;
}

export function CompanyUsersPanel({ company, asAdmin }: Props) {
  const { t } = useI18n();
  const { session } = useSession();
  const myId = session?.user.id;
  const [users, setUsers] = useState<CompanyUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState<{ editing: CompanyUser | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('company_users')
      .select(COMPANY_USER_COLUMNS)
      .eq('company_id', company.id)
      .order('full_name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setFailed(true);
        setUsers((data ?? []) as unknown as CompanyUser[]);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id, attempt]);

  const closed = company.status === 'closed';

  function canEdit(u: CompanyUser): boolean {
    if (u.user_id === myId) return false;
    return asAdmin || u.role !== 'owner';
  }

  function chips(u: CompanyUser) {
    const on = PERMISSIONS.filter((p) => u[p]);
    if (on.length === 0) return <span className="text-xs text-ink-400">{t('cusers.noPermissions')}</span>;
    return on.map((p) => <Badge key={p} tone="brand">{t(`perm.${p}`)}</Badge>);
  }

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {closed && <Alert tone="info">{t('cusers.closedNote')}</Alert>}
      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !users && <Spinner label={t('common.loading')} />}

      {users && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">{t('cusers.title')}</h2>
              <p className="text-sm text-ink-500">{t('cusers.count', { n: users.length })}</p>
            </div>
            {!closed && (
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => { setNotice(null); setDialog({ editing: null }); }}>
                {t('cusers.add')}
              </Button>
            )}
          </div>

          {users.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title={t('cusers.empty')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {users.map((u) => (
                <li key={u.user_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-900">{u.full_name}</p>
                      <Badge tone={u.role === 'owner' ? 'gold' : u.role === 'bookkeeper' ? 'sky' : 'neutral'}>{t(`role.${u.role}`)}</Badge>
                      <ActiveBadge active={u.is_active} />
                      {u.user_id === myId && <Badge>{t('cusers.you')}</Badge>}
                    </div>
                    <p dir="ltr" className="truncate text-xs text-ink-500 rtl:text-end">{u.email}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">{chips(u)}</div>
                  </div>
                  {canEdit(u) && (
                    <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => { setNotice(null); setDialog({ editing: u }); }}>
                      {t('common.edit')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <CompanyUserDialog
        open={dialog !== null}
        companyId={company.id}
        serviceModel={company.service_model}
        canChooseOwner={asAdmin}
        editing={dialog?.editing ?? null}
        onClose={() => setDialog(null)}
        onInvited={(email) => {
          setDialog(null);
          setNotice(t('invite.sent', { email }));
          setAttempt((a) => a + 1);
        }}
        onSaved={(saved) => {
          setDialog(null);
          setNotice(t('cusers.saved', { name: saved.full_name }));
          setUsers((list) => list?.map((x) => (x.user_id === saved.user_id ? saved : x)) ?? null);
        }}
      />
    </div>
  );
}
