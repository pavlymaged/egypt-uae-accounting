import { useEffect, useState } from 'react';
import { useSession } from '../../../auth/SessionProvider';
import { supabase } from '../../../lib/supabase';
import type { Currency } from '../../../types';

export interface EngineerCompany {
  companyId: string;
  currency: Currency;
  timeZone: string | null;
}

/** Company facts an engineer's screens need; null company id means the user is not a site engineer. */
export function useEngineerCompany() {
  const { activeCompany } = useSession();
  const companyId = activeCompany?.role === 'site_engineer' ? activeCompany.company_id : null;
  const [company, setCompany] = useState<EngineerCompany | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'notFound'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setState('loading');
    supabase
      .from('companies')
      .select('base_currency, time_zone')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return setState('failed');
        if (!data) return setState('notFound');
        setCompany({ companyId, currency: data.base_currency as Currency, timeZone: (data.time_zone as string | null) ?? null });
        setState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, attempt]);

  return { companyId, company, state, retry: () => setAttempt((a) => a + 1) };
}
