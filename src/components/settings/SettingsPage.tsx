import { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Users, DollarSign, Lock, Building2 } from 'lucide-react';
import OrganizationProfileModal from './OrganizationProfileModal';
import AdminUserManagement from './AdminUserManagement';
import TaxRatesModal from './TaxRatesModal';
import PeriodLocksModal from './PeriodLocksModal';

export default function SettingsPage() {
  const { currentOrganization, currentRole } = useOrganization();
  const { user } = useAuth();

  const [activeModal, setActiveModal] = useState<string | null>(null);

  const settingsSections = [
    {
      id: 'organization-profile',
      title: 'Organization Profile',
      description: 'Update company information and preferences',
      icon: Building2,
      color: 'blue',
    },
    {
      id: 'users-roles',
      title: 'Admin User Management',
      description: 'Create users and control access permissions',
      icon: Users,
      color: 'green',
      requiresAdmin: true,
    },
    {
      id: 'tax-rates',
      title: 'Tax Rates',
      description: 'Configure VAT and other tax rates',
      icon: DollarSign,
      color: 'orange',
    },
    {
      id: 'period-locks',
      title: 'Period Locks',
      description: 'Lock accounting periods',
      icon: Lock,
      color: 'amber',
      requiresAccountant: true,
    },
  ];

  const handleCardClick = (sectionId: string, canAccess: boolean) => {
    if (!canAccess) return;
    setActiveModal(sectionId);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-600">Manage your organization settings and preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{currentOrganization?.name}</h2>
            <p className="text-slate-600">
              {currentOrganization?.country} • {currentOrganization?.base_currency}
            </p>
            {currentOrganization?.vat_registration_number && (
              <p className="text-sm text-slate-500">
                VAT: {currentOrganization.vat_registration_number}
              </p>
            )}
          </div>
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {currentRole?.role.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          let canAccess = true;
          let accessMessage = '';

          if (section.requiresAdmin) {
            canAccess = currentRole && currentRole.role === 'super_admin';
            accessMessage = 'Admin access required';
          } else if (section.requiresAccountant) {
            canAccess = currentRole && ['super_admin', 'accountant'].includes(currentRole.role);
            accessMessage = 'Accountant access required';
          }

          const colorClasses = {
            blue: { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:border-blue-300' },
            green: { bg: 'bg-green-50', text: 'text-green-600', hover: 'hover:border-green-300' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-600', hover: 'hover:border-orange-300' },
            amber: { bg: 'bg-amber-50', text: 'text-amber-600', hover: 'hover:border-amber-300' },
          };

          const colors = colorClasses[section.color as keyof typeof colorClasses] || colorClasses.blue;

          return (
            <button
              key={section.id}
              onClick={() => handleCardClick(section.id, canAccess)}
              disabled={!canAccess}
              className={`bg-white rounded-xl border-2 border-slate-200 p-6 text-left ${
                canAccess
                  ? `${colors.hover} hover:shadow-lg cursor-pointer transform hover:scale-105 active:scale-100`
                  : 'opacity-50 cursor-not-allowed'
              } transition-all duration-200`}
            >
              <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${colors.text}`} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{section.title}</h3>
              <p className="text-sm text-slate-600">{section.description}</p>
              {!canAccess && (
                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {accessMessage}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          <Settings className="w-5 h-5 inline mr-2" />
          System Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-600">Logged in as:</span>
            <span className="ml-2 font-medium text-slate-900">{user?.email}</span>
          </div>
          <div>
            <span className="text-slate-600">Role:</span>
            <span className="ml-2 font-medium text-slate-900">{currentRole?.role}</span>
          </div>
          <div>
            <span className="text-slate-600">Organization ID:</span>
            <span className="ml-2 font-mono text-xs text-slate-900">{currentOrganization?.id.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-slate-600">Default VAT Rate:</span>
            <span className="ml-2 font-medium text-slate-900">{currentOrganization?.default_vat_rate}%</span>
          </div>
        </div>
      </div>

      <OrganizationProfileModal
        isOpen={activeModal === 'organization-profile'}
        onClose={() => setActiveModal(null)}
      />
      <AdminUserManagement
        isOpen={activeModal === 'users-roles'}
        onClose={() => setActiveModal(null)}
      />
      <TaxRatesModal
        isOpen={activeModal === 'tax-rates'}
        onClose={() => setActiveModal(null)}
      />
      <PeriodLocksModal
        isOpen={activeModal === 'period-locks'}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
