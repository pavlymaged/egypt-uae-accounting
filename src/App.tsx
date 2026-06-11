import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useOrganization } from './contexts/OrganizationContext';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import EngineerDashboard from './components/engineers/EngineerDashboard';
import ClientPortal from './pages/client-portal/ClientPortal';

function App() {
  const { user, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading } = useOrganization();
  const [isSiteEngineer, setIsSiteEngineer] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isClientPortal, setIsClientPortal] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      setIsClientPortal(hash === '#/client-portal' || path === '/client-portal');
    };
    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  useEffect(() => {
    if (isClientPortal) {
      setRoleChecked(true);
      return;
    }
    if (!user) {
      setIsSiteEngineer(false);
      setRoleChecked(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('site_engineers')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1);

      const hasOrgRole = roles && roles.length > 0;
      const hasEngineerProfile = data && data.length > 0;
      setIsSiteEngineer(hasEngineerProfile && !hasOrgRole);
      setRoleChecked(true);
    })();
  }, [user, isClientPortal]);

  if (isClientPortal) {
    return <ClientPortal />;
  }

  if (authLoading || orgLoading || !roleChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (isSiteEngineer) {
    return <EngineerDashboard />;
  }

  if (organizations.length === 0) {
    return <Onboarding />;
  }

  return <Dashboard />;
}

export default App;
