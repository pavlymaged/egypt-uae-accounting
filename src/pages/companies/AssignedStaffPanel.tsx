import { Plus, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { SelectInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate } from '../../lib/dates';
import { isNetworkError, isUniqueViolation } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import type { Company, StaffRole } from '../../types';
import { StaffRoleBadge } from '../staff/StaffListPage';

interface Assignment {
  staff_user_id: string;
  assigned_at: string;
  staff: { full_name: string; staff_role: StaffRole } | null;
}

interface Candidate {
  user_id: string;
  full_name: string;
  staff_role: StaffRole;
}

export function AssignedStaffPanel({ company }: { company: Pick<Company, 'id' | 'service_model' | 'status'> }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const [busyRemove, setBusyRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const managed = company.service_model === 'managed';

  useEffect(() => {
    if (!managed) return;
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase
        .from('staff_assignments')
        .select('staff_user_id, assigned_at, staff:staff_members(full_name, staff_role)')
        .eq('company_id', company.id)
        .order('assigned_at'),
      supabase
        .from('staff_members')
        .select('user_id, full_name, staff_role')
        .in('staff_role', ['checker', 'accountant'])
        .eq('is_active', true)
        .order('full_name'),
    ]).then(([a, s]) => {
      if (cancelled) return;
      if (a.error || s.error) return setFailed(true);
      setRows((a.data ?? []) as unknown as Assignment[]);
      setCandidates((s.data ?? []) as Candidate[]);
    });
    return () => {
      cancelled = true;
    };
  }, [company.id, managed, attempt]);

  const available = useMemo(() => {
    const taken = new Set(rows?.map((r) => r.staff_user_id));
    return candidates.filter((c) => !taken.has(c.user_id));
  }, [rows, candidates]);

  if (!managed) {
    return (
      <Card>
        <EmptyState icon={<UsersRound className="h-6 w-6" />} title={t('assign.selfService')} />
      </Card>
    );
  }

  async function add() {
    setError(null);
    setNotice(null);
    if (!selected) return setError(t('assign.chooseRequired'));
    setAdding(true);
    const { error: err } = await supabase.from('staff_assignments').insert({ staff_user_id: selected, company_id: company.id });
    setAdding(false);
    if (err) {
      if (isNetworkError(err)) return setError(t('common.networkError'));
      if (isUniqueViolation(err)) return setError(t('assign.already'));
      return setError(t('common.saveFailed', { msg: err.message }));
    }
    const name = candidates.find((c) => c.user_id === selected)?.full_name ?? '';
    setSelected('');
    setNotice(t('assign.added', { name }));
    setAttempt((n) => n + 1);
  }

  async function remove() {
    if (!removing) return;
    setBusyRemove(true);
    const { data, error: err } = await supabase
      .from('staff_assignments')
      .delete()
      .eq('company_id', company.id)
      .eq('staff_user_id', removing.staff_user_id)
      .select('staff_user_id');
    setBusyRemove(false);
    const name = removing.staff?.full_name ?? '';
    setRemoving(null);
    setNotice(null);
    if (err) return setError(isNetworkError(err) ? t('common.networkError') : t('common.saveFailed', { msg: err.message }));
    if (!data || data.length === 0) return setError(t('common.notSaved'));
    setError(null);
    setNotice(t('assign.removed', { name }));
    setAttempt((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !rows && <Spinner label={t('common.loading')} />}

      {rows && (
        <Card>
          <div className="border-b border-ink-200 px-5 py-4">
            <h2 className="text-base font-semibold text-ink-900">{t('assign.title')}</h2>
            <p className="text-sm text-ink-500">{t('assign.body')}</p>
          </div>

          {company.status !== 'closed' && (
            <div className="flex flex-col gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-4 sm:flex-row sm:items-center">
              <label htmlFor="assign-staff" className="sr-only">{t('assign.choose')}</label>
              <SelectInput id="assign-staff" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={available.length === 0}>
                <option value="">{available.length === 0 ? t('assign.noneAvailable') : t('assign.choose')}</option>
                {available.map((c) => (
                  <option key={c.user_id} value={c.user_id}>{c.full_name} - {t(`role.${c.staff_role}`)}</option>
                ))}
              </SelectInput>
              <Button icon={<Plus className="h-4 w-4" />} loading={adding} disabled={available.length === 0} onClick={() => void add()}>
                {t('assign.add')}
              </Button>
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState icon={<UsersRound className="h-6 w-6" />} title={t('assign.empty')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {rows.map((r) => (
                <li key={r.staff_user_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{r.staff?.full_name ?? t('common.notSet')}</p>
                    <p className="text-xs text-ink-500">{t('assign.since', { date: formatDate(r.assigned_at, lang) })}</p>
                  </div>
                  {r.staff && <StaffRoleBadge role={r.staff.staff_role} />}
                  <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setRemoving(r)}>
                    {t('assign.remove')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t('assign.removeTitle')}
        confirmLabel={t('assign.remove')}
        tone="danger"
        loading={busyRemove}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      >
        {t('assign.removeBody', { name: removing?.staff?.full_name ?? '' })}
      </ConfirmDialog>
    </div>
  );
}
