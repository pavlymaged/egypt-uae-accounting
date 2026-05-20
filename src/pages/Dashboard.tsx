import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  LayoutDashboard, FolderKanban, Users, Tag, DollarSign, Percent,
  CreditCard, HardHat, ShoppingCart, FileCheck, Wallet, ArrowRightLeft,
  BarChart3, FileSpreadsheet, Building2, Settings, LogOut, Menu, X,
  ChevronDown, ChevronRight, Banknote, UserCog, ClipboardCheck, type LucideIcon,
} from 'lucide-react';
import DashboardHome from '../components/dashboard/DashboardHome';
import ProjectsPage from '../components/projects/ProjectsPage';
import ClientsPage from '../components/clients/ClientsPage';
import ServiceTypesPage from '../components/data-validation/ServiceTypesPage';
import RecordIncomePage from '../components/income/RecordIncomePage';
import ManagementFeePage from '../components/income/ManagementFeePage';
import GeneralExpensesPage from '../components/expenses/GeneralExpensesPage';
import EmployeeAdvancePage from '../components/expenses/EmployeeAdvancePage';
import SiteExpensesPage from '../components/expenses/SiteExpensesPage';
import VendorsPage from '../components/vendors/VendorsPage';
import VendorQuotationsPage from '../components/vendors/VendorQuotationsPage';
import VendorPaymentsPage from '../components/vendors/VendorPaymentsPage';
import CashTransferPage from '../components/general/CashTransferPage';
import VendorBalanceReport from '../components/reports/VendorBalanceReport';
import CashBalanceReport from '../components/reports/CashBalanceReport';
import SiteSheetReport from '../components/reports/SiteSheetReport';
import ClientSheetReport from '../components/reports/ClientSheetReport';
import SettingsPage from '../components/settings/SettingsPage';
import SiteEngineersPage from '../components/engineers/SiteEngineersPage';
import EngineerExpenseReviewPage from '../components/engineers/EngineerExpenseReviewPage';
import { supabase } from '../lib/supabase';

type PageType =
  | 'dashboard'
  | 'projects'
  | 'clients'
  | 'service-types'
  | 'record-income'
  | 'management-fee'
  | 'general-expenses'
  | 'employee-advance'
  | 'site-expenses'
  | 'vendors'
  | 'vendor-quotations'
  | 'vendor-payments'
  | 'cash-transfer'
  | 'report-vendor-balance'
  | 'report-cash-balance'
  | 'report-site-sheet'
  | 'report-client-sheet'
  | 'site-engineers'
  | 'engineer-expenses'
  | 'settings';

interface NavGroup {
  label: string;
  items: { id: PageType; label: string; icon: LucideIcon }[];
}

const navigationGroups: NavGroup[] = [
  {
    label: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Projects',
    items: [
      { id: 'projects', label: 'Manage Projects', icon: FolderKanban },
      { id: 'clients', label: 'Clients', icon: Users },
    ],
  },
  {
    label: 'Data Validation',
    items: [
      { id: 'service-types', label: 'Service Types', icon: Tag },
    ],
  },
  {
    label: 'Income',
    items: [
      { id: 'record-income', label: 'Record Income', icon: DollarSign },
      { id: 'management-fee', label: 'Management Fee', icon: Percent },
    ],
  },
  {
    label: 'Expenses',
    items: [
      { id: 'general-expenses', label: 'General Expenses', icon: CreditCard },
      { id: 'employee-advance', label: 'Employee Advance', icon: Banknote },
      { id: 'site-expenses', label: 'Site Expenses', icon: HardHat },
    ],
  },
  {
    label: 'Vendors',
    items: [
      { id: 'vendors', label: 'Manage Vendors', icon: ShoppingCart },
      { id: 'vendor-quotations', label: 'Quotations', icon: FileCheck },
      { id: 'vendor-payments', label: 'Payments', icon: Wallet },
    ],
  },
  {
    label: 'Site Engineers',
    items: [
      { id: 'site-engineers', label: 'Manage Engineers', icon: UserCog },
      { id: 'engineer-expenses', label: 'Expense Review', icon: ClipboardCheck },
    ],
  },
  {
    label: 'General',
    items: [
      { id: 'cash-transfer', label: 'Cash Transfer', icon: ArrowRightLeft },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { id: 'report-vendor-balance', label: 'Vendor Balance', icon: BarChart3 },
      { id: 'report-cash-balance', label: 'Cash Balance', icon: DollarSign },
      { id: 'report-site-sheet', label: 'Site Sheet', icon: FileSpreadsheet },
      { id: 'report-client-sheet', label: 'Client Sheet', icon: Users },
    ],
  },
  {
    label: '',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export interface NavigationContext {
  prefillEngineer?: { id: string; name: string; email: string; phone: string };
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const { currentOrganization, organizations, switchOrganization } = useOrganization();
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [pendingEngineerCount, setPendingEngineerCount] = useState(0);
  const [navContext, setNavContext] = useState<NavigationContext>({});

  const navigateTo = (page: PageType, context?: NavigationContext) => {
    setNavContext(context || {});
    setCurrentPage(page);
  };

  useEffect(() => {
    if (currentOrganization) fetchPendingEngineerExpenses();
    const interval = setInterval(() => { if (currentOrganization) fetchPendingEngineerExpenses(); }, 30000);
    return () => clearInterval(interval);
  }, [currentOrganization]);

  const fetchPendingEngineerExpenses = async () => {
    if (!currentOrganization) return;
    const { count } = await supabase
      .from('engineer_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'Pending');
    setPendingEngineerCount(count || 0);
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardHome />;
      case 'projects': return <ProjectsPage />;
      case 'clients': return <ClientsPage />;
      case 'service-types': return <ServiceTypesPage />;
      case 'record-income': return <RecordIncomePage />;
      case 'management-fee': return <ManagementFeePage />;
      case 'general-expenses': return <GeneralExpensesPage />;
      case 'employee-advance': return <EmployeeAdvancePage prefillEngineer={navContext.prefillEngineer} onClearPrefill={() => setNavContext({})} />;
      case 'site-expenses': return <SiteExpensesPage />;
      case 'vendors': return <VendorsPage />;
      case 'vendor-quotations': return <VendorQuotationsPage />;
      case 'vendor-payments': return <VendorPaymentsPage />;
      case 'cash-transfer': return <CashTransferPage />;
      case 'report-vendor-balance': return <VendorBalanceReport />;
      case 'report-cash-balance': return <CashBalanceReport />;
      case 'report-site-sheet': return <SiteSheetReport />;
      case 'report-client-sheet': return <ClientSheetReport />;
      case 'site-engineers': return <SiteEngineersPage onNavigateToAdvance={(engineer) => navigateTo('employee-advance', { prefillEngineer: engineer })} />;
      case 'engineer-expenses': return <EngineerExpenseReviewPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 flex flex-col`}
      >
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4 lg:mb-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900">Project Manager</h1>
                <p className="text-xs text-slate-600">Accounting System</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {currentOrganization && (
            <div className="mt-4 relative">
              <button
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
              >
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {currentOrganization.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {currentOrganization.country} - {currentOrganization.base_currency}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-600 transition ${orgDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {orgDropdownOpen && organizations.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => { switchOrganization(org.id); setOrgDropdownOpen(false); }}
                      className={`w-full text-left p-3 hover:bg-slate-50 transition ${org.id === currentOrganization.id ? 'bg-blue-50' : ''}`}
                    >
                      <div className="text-sm font-medium text-slate-900">{org.name}</div>
                      <div className="text-xs text-slate-600">{org.country} - {org.base_currency}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navigationGroups.map((group, gi) => {
            const hasActiveItem = group.items.some(item => item.id === currentPage);
            const isCollapsed = group.label && collapsedGroups[group.label] && !hasActiveItem;

            return (
              <div key={gi}>
                {group.label && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-2 mt-3 mb-0.5"
                  >
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{group.label}</span>
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                )}

                {!isCollapsed && group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  const badge = item.id === 'engineer-expenses' && pendingEngineerCount > 0 ? pendingEngineerCount : 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setCurrentPage(item.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-700 hover:bg-slate-50 rounded-lg transition text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
        </header>

        <div className="flex-1 overflow-y-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
