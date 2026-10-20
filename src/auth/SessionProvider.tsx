import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TranslationKey } from '../i18n/en';
import { supabase } from '../lib/supabase';
import { STAFF_COLUMNS, type CompanyMembership, type StaffMember } from '../types';

export type Identity =
  | { kind: 'staff'; staff: StaffMember; aal2: boolean; hasVerifiedFactor: boolean }
  | { kind: 'company'; memberships: CompanyMembership[] }
  | { kind: 'error' };

type Status = 'loading' | 'signedOut' | 'ready';

interface SessionValue {
  status: Status;
  session: Session | null;
  identity: Identity | null;
  notice: TranslationKey | null;
  clearNotice: () => void;
  recovery: boolean;
  activeCompany: CompanyMembership | null;
  chooseCompany: (companyId: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);
const COMPANY_KEY = 'thalatha.activeCompany';

async function resolveIdentity(userId: string): Promise<Identity | 'disabled' | 'noAccess'> {
  const staffRes = await supabase.from('staff_members').select(STAFF_COLUMNS).eq('user_id', userId).maybeSingle();
  if (staffRes.error) return { kind: 'error' };

  if (staffRes.data) {
    const staff = staffRes.data as StaffMember;
    if (!staff.is_active) return 'disabled';
    const [aalRes, factorsRes] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    if (aalRes.error || factorsRes.error) return { kind: 'error' };
    return {
      kind: 'staff',
      staff,
      aal2: aalRes.data.currentLevel === 'aal2',
      hasVerifiedFactor: factorsRes.data.totp.length > 0,
    };
  }

  const memberRes = await supabase
    .from('company_users')
    .select('company_id, role, full_name, company:companies(id, code, name, status)')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (memberRes.error) return { kind: 'error' };

  const memberships = ((memberRes.data ?? []) as unknown as CompanyMembership[])
    .filter((m) => m.company)
    .sort((a, b) => a.company.name.localeCompare(b.company.name));
  if (memberships.length === 0) return 'noAccess';
  return { kind: 'company', memberships };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => sessionStorage.getItem(COMPANY_KEY));
  const resolvedFor = useRef<string | null>(null);

  const load = useCallback(async (current: Session | null) => {
    setSession(current);
    if (!current) {
      resolvedFor.current = null;
      setIdentity(null);
      setStatus('signedOut');
      return;
    }
    const result = await resolveIdentity(current.user.id);
    if (result === 'disabled' || result === 'noAccess') {
      setNotice(result === 'disabled' ? 'identity.disabled' : 'identity.noAccess');
      resolvedFor.current = null;
      setIdentity(null);
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setStatus('signedOut');
      return;
    }
    setIdentity(result);
    setStatus('ready');
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      const userId = next?.user.id ?? null;
      const forceReload = event === 'INITIAL_SESSION' || event === 'MFA_CHALLENGE_VERIFIED';
      if (userId !== null && resolvedFor.current === userId && !forceReload) {
        setSession(next);
        return;
      }
      resolvedFor.current = userId;
      (async () => {
        await load(next);
      })();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem(COMPANY_KEY);
    setActiveCompanyId(null);
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const chooseCompany = useCallback((companyId: string) => {
    sessionStorage.setItem(COMPANY_KEY, companyId);
    setActiveCompanyId(companyId);
  }, []);

  const activeCompany = useMemo(() => {
    if (identity?.kind !== 'company') return null;
    if (identity.memberships.length === 1) return identity.memberships[0];
    return identity.memberships.find((m) => m.company_id === activeCompanyId) ?? null;
  }, [identity, activeCompanyId]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      session,
      identity,
      notice,
      clearNotice: () => setNotice(null),
      recovery,
      activeCompany,
      chooseCompany,
      refresh,
      signOut,
    }),
    [status, session, identity, notice, recovery, activeCompany, chooseCompany, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export function useStaff(): StaffMember | null {
  const { identity } = useSession();
  return identity?.kind === 'staff' ? identity.staff : null;
}
