import { Building2, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fromPath } from '../../auth/guards';
import { useSession } from '../../auth/SessionProvider';
import { Badge } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { AuthLayout } from './AuthLayout';

export function ChooseCompanyPage() {
  const { t } = useI18n();
  const { identity, chooseCompany, signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  if (identity?.kind !== 'company') return null;

  return (
    <AuthLayout title={t('picker.title')} subtitle={t('picker.body')} onSignOut={signOut}>
      <ul className="space-y-3">
        {identity.memberships.map((m) => (
          <li key={m.company_id}>
            <button
              type="button"
              onClick={() => {
                chooseCompany(m.company_id);
                navigate(fromPath(location.state), { replace: true });
              }}
              className="group flex w-full items-center gap-4 rounded-xl border border-ink-200 bg-white p-4 text-start transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-900">{m.company.name}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                  <span dir="ltr" className="font-mono">{m.company.code}</span>
                  <Badge tone="brand">{t(`role.${m.role}`)}</Badge>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-ink-300 transition-colors group-hover:text-brand-600 rtl:-scale-x-100" />
            </button>
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}
