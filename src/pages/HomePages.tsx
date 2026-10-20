import { Building2, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/ui/Button';
import { Alert, Card } from '../components/ui/Feedback';
import { useI18n } from '../i18n/I18nProvider';
import { supabase } from '../lib/supabase';
import { isPlatformAdmin, type StaffMember } from '../types';

interface Counts {
  companies: number;
  staff: number | null;
}

async function loadCounts(staff: StaffMember): Promise<Counts> {
  const companies = await supabase.from('companies').select('id', { count: 'exact', head: true });
  if (companies.error) throw companies.error;
  if (!isPlatformAdmin(staff.staff_role)) return { companies: companies.count ?? 0, staff: null };
  const members = await supabase.from('staff_members').select('user_id', { count: 'exact', head: true });
  if (members.error) throw members.error;
  return { companies: companies.count ?? 0, staff: members.count ?? 0 };
}

export function StaffDashboard({ staff }: { staff: StaffMember }) {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const admin = isPlatformAdmin(staff.staff_role);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    loadCounts(staff)
      .then((c) => !cancelled && setCounts(c))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [staff, attempt]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">{t('dashboard.title')}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{t('dashboard.greeting', { name: staff.full_name })}</h1>
      </div>

      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Building2}
          label={admin ? t('dashboard.companies') : t('dashboard.assigned')}
          value={counts?.companies}
          to={admin ? '/companies' : '/my-companies'}
        />
        {admin && <StatCard icon={Users} label={t('dashboard.staff')} value={counts?.staff ?? undefined} to="/staff" />}
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-white/60 px-5 py-4 text-sm text-ink-600">
        <Sparkles className="h-4 w-4 shrink-0 text-gold-500" />
        {t('dashboard.later')}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to }: { icon: LucideIcon; label: string; value: number | undefined; to: string }) {
  return (
    <Link to={to} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl">
      <Card className="p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-md">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-4 text-3xl font-semibold tabular-nums text-ink-900">
          {value === undefined ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-ink-100" /> : value}
        </p>
      </Card>
    </Link>
  );
}

export function CompanyHome() {
  const { t } = useI18n();
  const { activeCompany } = useSession();
  if (!activeCompany) return null;
  return (
    <div className="animate-fade-in">
      <Card className="overflow-hidden">
        <div className="relative bg-brand-900 px-6 py-10 text-white sm:px-10">
          <div aria-hidden className="pointer-events-none absolute -top-16 end-0 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl" />
          <p className="relative font-mono text-xs text-brand-200" dir="ltr">{activeCompany.company.code}</p>
          <h1 className="relative mt-2 text-2xl font-semibold sm:text-3xl">{t('home.welcome', { company: activeCompany.company.name })}</h1>
          <div className="relative mt-4 flex items-center gap-2 text-sm text-brand-100">
            <span>{t('home.role')}:</span>
            <span className="rounded-full bg-white/10 px-3 py-0.5 font-medium text-white ring-1 ring-inset ring-white/20">
              {t(`role.${activeCompany.role}`)}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-4 px-6 py-8 sm:px-10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-ink-900">{t('home.setup')}</h2>
            <p className="mt-1 text-sm text-ink-500">{t('home.setupBody')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
