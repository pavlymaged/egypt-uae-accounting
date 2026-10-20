import { ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStaff } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/Feedback';
import { TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { STAFF_COLUMNS, STAFF_ROLES, type StaffMember, type StaffRole } from '../../types';
import { AddStaffDialog } from './AddStaffDialog';

const roleTones = { super_admin: 'gold', accounting_manager: 'brand', checker: 'sky', accountant: 'neutral' } as const;

export function StaffRoleBadge({ role }: { role: StaffRole }) {
  const { t } = useI18n();
  return <Badge tone={roleTones[role]}>{t(`role.${role}`)}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return <Badge tone={active ? 'success' : 'danger'}>{active ? t('common.active') : t('common.inactive')}</Badge>;
}

export function StaffListPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const me = useStaff();
  const [adding, setAdding] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);
  const invitableRoles: readonly StaffRole[] = me?.staff_role === 'super_admin' ? STAFF_ROLES : ['checker', 'accountant'];

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('staff_members')
      .select(STAFF_COLUMNS)
      .order('full_name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setStaff((data ?? []) as StaffMember[]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    if (!staff) return [];
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [staff, query]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => { setInvited(null); setAdding(true); }}>
            {t('invite.addStaff')}
          </Button>
        }
      />

      {invited && (
        <div className="mb-4">
          <Alert tone="success">{t('invite.sent', { email: invited })}</Alert>
        </div>
      )}

      <AddStaffDialog
        open={adding}
        roles={invitableRoles}
        onClose={() => setAdding(false)}
        onInvited={(email) => {
          setAdding(false);
          setInvited(email);
          setAttempt((a) => a + 1);
        }}
      />

      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !staff && <Spinner label={t('common.loading')} />}

      {staff && (
        <Card>
          <div className="border-b border-ink-200 p-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('staff.search')} aria-label={t('staff.search')} className="ps-9" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title={t('staff.empty')} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
                      <th className="px-4 py-3 text-start">{t('staff.col.name')}</th>
                      <th className="px-4 py-3 text-start">{t('staff.col.role')}</th>
                      <th className="px-4 py-3 text-start">{t('staff.col.position')}</th>
                      <th className="px-4 py-3 text-start">{t('staff.col.joined')}</th>
                      <th className="px-4 py-3 text-start">{t('staff.col.state')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filtered.map((s) => (
                      <tr key={s.user_id} onClick={() => navigate(`/staff/${s.user_id}`)} className="cursor-pointer transition-colors hover:bg-brand-50/40">
                        <td className="px-4 py-3">
                          <Link to={`/staff/${s.user_id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink-900 hover:text-brand-700 hover:underline">
                            {s.full_name}
                          </Link>
                          <p dir="ltr" className="text-xs text-ink-500 rtl:text-end">{s.email}</p>
                        </td>
                        <td className="px-4 py-3"><StaffRoleBadge role={s.staff_role} /></td>
                        <td className="px-4 py-3 text-ink-700">{s.position_title || <span className="text-ink-400">{t('common.notSet')}</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-700">{formatDate(s.joining_date, lang)}</td>
                        <td className="px-4 py-3"><ActiveBadge active={s.is_active} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-ink-100 md:hidden">
                {filtered.map((s) => (
                  <li key={s.user_id}>
                    <Link to={`/staff/${s.user_id}`} className="flex items-start gap-3 p-4 transition-colors hover:bg-brand-50/40">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="font-medium text-ink-900">{s.full_name}</p>
                        <p dir="ltr" className="truncate text-xs text-ink-500 rtl:text-end">{s.email}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <StaffRoleBadge role={s.staff_role} />
                          <ActiveBadge active={s.is_active} />
                        </div>
                        <p className="text-xs text-ink-500">
                          {s.position_title || t('common.notSet')} · {formatDate(s.joining_date, lang)}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
