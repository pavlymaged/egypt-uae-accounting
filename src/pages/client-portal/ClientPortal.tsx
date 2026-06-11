import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import ClientLogin from './ClientLogin';
import ClientPortalDashboard from './ClientPortalDashboard';

export default function ClientPortal() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const { data: portalUser } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setAuthenticated(!!portalUser);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <ClientLogin onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return <ClientPortalDashboard onLogout={() => setAuthenticated(false)} />;
}
