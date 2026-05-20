import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  country: 'Egypt' | 'UAE';
  base_currency: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_registration_number: string | null;
  vat_registration_number: string | null;
  default_vat_rate: number;
  fiscal_year_start_month: number;
}

interface UserRole {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'super_admin' | 'accountant' | 'staff';
  permissions: any;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentRole: UserRole | null;
  loading: boolean;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*, organizations(*)')
        .eq('user_id', user.id);

      if (rolesError) throw rolesError;

      const orgs = roles?.map((role: any) => role.organizations) || [];
      setOrganizations(orgs);

      const savedOrgId = localStorage.getItem('currentOrganizationId');
      let selectedOrg = orgs.find((org: Organization) => org.id === savedOrgId) || orgs[0] || null;

      setCurrentOrganization(selectedOrg);

      if (selectedOrg) {
        const role = roles?.find((r: any) => r.organization_id === selectedOrg.id);
        setCurrentRole(role || null);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  const switchOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', orgId);

      supabase
        .from('user_roles')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', user?.id)
        .single()
        .then(({ data }) => {
          setCurrentRole(data);
        });
    }
  };

  const refreshOrganizations = async () => {
    await fetchOrganizations();
  };

  const refreshOrganization = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrganization.id)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentOrganization(data);
        setOrganizations(orgs => orgs.map(org => org.id === data.id ? data : org));
      }
    } catch (error) {
      console.error('Error refreshing organization:', error);
    }
  };

  const value = {
    organizations,
    currentOrganization,
    currentRole,
    loading,
    switchOrganization,
    refreshOrganizations,
    refreshOrganization,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
