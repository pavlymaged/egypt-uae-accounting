import { Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Alert, FormSection, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { supabase } from '../../lib/supabase';
import type { Company } from '../../types';
import { CompanyStatusBadge } from '../companies/CompanyBadges';

type Assigned = Pick<Company, 'id' | 'code' | 'name' | 'status'>;

export function AssignedCompaniesSection({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Assigned[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('staff_assignments')
      .select('company:companies(id, code, name, status)')
      .eq('staff_user_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setFailed(true);
        const list = ((data ?? []) as unknown as { company: Assigned | null }[])
          .map((r) => r.company)
          .filter((c): c is Assigned => c !== null)
          .sort((a, b) => a.name.localeCompare(b.name));
        setRows(list);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  return (
    <FormSection title={t('assign.companiesTitle')} description={t('assign.companiesBody')}>
      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !rows && <Spinner />}
      {rows && rows.length === 0 && <p className="text-sm text-ink-500">{t('assign.noCompanies')}</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Building2 className="h-4 w-4 shrink-0 text-ink-400" />
              <Link to={`/companies/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-brand-700 hover:underline">
                {c.name}
              </Link>
              <span dir="ltr" className="font-mono text-xs text-ink-500">{c.code}</span>
              <CompanyStatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
