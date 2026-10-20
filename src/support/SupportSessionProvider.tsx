import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession, useStaff } from '../auth/SessionProvider';
import { isNetworkError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { SUPPORT_COLUMNS, isPlatformAdmin, type SupportSession } from '../types';

export type ActiveSupportSession = SupportSession & { company: { name: string; code: string } | null };

interface SupportValue {
  active: ActiveSupportSession | null;
  refresh: () => Promise<void>;
  close: (id: string) => Promise<'ok' | 'notSaved' | 'network' | { msg: string }>;
}

const SupportContext = createContext<SupportValue | null>(null);

const POLL_MS = 60_000;

export function SupportSessionProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const staff = useStaff();
  const userId = session?.user.id;
  const eligible = !!staff && isPlatformAdmin(staff.staff_role) && staff.is_active;
  const [active, setActive] = useState<ActiveSupportSession | null>(null);

  const refresh = useCallback(async () => {
    if (!eligible || !userId) {
      setActive(null);
      return;
    }
    const { data, error } = await supabase
      .from('support_sessions')
      .select(`${SUPPORT_COLUMNS}, company:companies(name, code)`)
      .eq('staff_user_id', userId)
      .is('closed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return;
    setActive((data as unknown as ActiveSupportSession) ?? null);
  }, [eligible, userId]);

  useEffect(() => {
    void refresh();
    if (!eligible) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh, eligible]);

  useEffect(() => {
    if (!active) return;
    const ms = new Date(active.expires_at).getTime() - Date.now();
    const id = window.setTimeout(() => setActive(null), Math.max(ms, 0) + 500);
    return () => window.clearTimeout(id);
  }, [active]);

  const close = useCallback<SupportValue['close']>(
    async (id) => {
      const { data, error } = await supabase
        .from('support_sessions')
        .update({ closed_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) return isNetworkError(error) ? 'network' : { msg: error.message };
      if (!data) return 'notSaved';
      await refresh();
      return 'ok';
    },
    [refresh],
  );

  return <SupportContext.Provider value={{ active, refresh, close }}>{children}</SupportContext.Provider>;
}

export function useSupportSession(): SupportValue {
  const value = useContext(SupportContext);
  if (!value) throw new Error('useSupportSession must be used inside SupportSessionProvider');
  return value;
}
