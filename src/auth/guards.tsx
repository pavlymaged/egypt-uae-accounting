import type { Location } from 'react-router-dom';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FullPageSpinner } from '../components/ui/Feedback';
import { useI18n } from '../i18n/I18nProvider';
import { IdentityErrorPage } from '../pages/auth/IdentityErrorPage';
import { useSession, type Identity } from './SessionProvider';

export function fromPath(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from;
  if (!from || from.pathname.startsWith('/login')) return '/';
  return `${from.pathname}${from.search}${from.hash}`;
}

export function RequireApp() {
  const { status, identity, activeCompany } = useSession();
  const location = useLocation();
  const { t } = useI18n();

  if (status === 'loading') return <FullPageSpinner label={t('common.loading')} />;
  if (status === 'signedOut' || !identity) return <Navigate to="/login" replace state={{ from: location }} />;
  if (identity.kind === 'error') return <IdentityErrorPage />;
  if (identity.kind === 'staff' && !identity.aal2) {
    return <Navigate to={identity.hasVerifiedFactor ? '/mfa/verify' : '/mfa/setup'} replace state={{ from: location }} />;
  }
  if (identity.kind === 'company' && !activeCompany) {
    return <Navigate to="/choose-company" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function PublicOnly() {
  const { status } = useSession();
  const location = useLocation();
  const { t } = useI18n();
  if (status === 'loading') return <FullPageSpinner label={t('common.loading')} />;
  if (status === 'ready') return <Navigate to={fromPath(location.state)} replace />;
  return <Outlet />;
}

export function RequirePendingMfa({ children }: { children: (identity: Extract<Identity, { kind: 'staff' }>) => ReactNode }) {
  const { status, identity } = useSession();
  const location = useLocation();
  const { t } = useI18n();
  if (status === 'loading') return <FullPageSpinner label={t('common.loading')} />;
  if (status === 'signedOut' || !identity) return <Navigate to="/login" replace />;
  if (identity.kind !== 'staff' || identity.aal2) return <Navigate to={fromPath(location.state)} replace />;
  return <>{children(identity)}</>;
}

export function RequireCompanyChoice({ children }: { children: ReactNode }) {
  const { status, identity } = useSession();
  const location = useLocation();
  const { t } = useI18n();
  if (status === 'loading') return <FullPageSpinner label={t('common.loading')} />;
  if (status === 'signedOut' || !identity) return <Navigate to="/login" replace />;
  if (identity.kind !== 'company' || identity.memberships.length < 2) return <Navigate to={fromPath(location.state)} replace />;
  return <>{children}</>;
}
