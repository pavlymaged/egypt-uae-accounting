import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { FolderKanban, DollarSign, TrendingUp, TrendingDown, Users, ShoppingCart, Clock } from 'lucide-react';

interface DashboardStats {
  activeProjects: number;
  totalProjects: number;
  totalIncome: number;
  totalMf: number;
  totalExpenses: number;
  totalVendorPayments: number;
  netCash: number;
  activeClients: number;
  activeVendors: number;
  recentIncome: { income_number: string; amount: number; payment_date: string; project_code?: string }[];
  recentExpenses: { expense_number: string; amount: number; expense_date: string; description: string }[];
}

export default function DashboardHome() {
  const { currentOrganization } = useOrganization();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0, totalProjects: 0, totalIncome: 0, totalMf: 0,
    totalExpenses: 0, totalVendorPayments: 0, netCash: 0, activeClients: 0,
    activeVendors: 0, recentIncome: [], recentExpenses: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) fetchStats();
  }, [currentOrganization]);

  const fetchStats = async () => {
    if (!currentOrganization) return;
    try {
      const orgId = currentOrganization.id;

      const [projectsRes, clientsRes, vendorsRes, incomeRes, expensesRes, vendorPaymentsRes, recentIncomeRes, recentExpensesRes] = await Promise.all([
        supabase.from('projects').select('id, project_status').eq('organization_id', orgId),
        supabase.from('customers').select('id').eq('organization_id', orgId).eq('is_active', true),
        supabase.from('vendors').select('id').eq('organization_id', orgId).eq('is_active', true),
        supabase.from('project_income').select('amount, management_fee_amount').eq('organization_id', orgId),
        supabase.from('project_expenses').select('amount').eq('organization_id', orgId),
        supabase.from('vendor_project_payments').select('amount').eq('organization_id', orgId),
        supabase.from('project_income').select('income_number, amount, payment_date, project:projects(project_code)').eq('organization_id', orgId).order('payment_date', { ascending: false }).limit(5),
        supabase.from('project_expenses').select('expense_number, amount, expense_date, description').eq('organization_id', orgId).order('expense_date', { ascending: false }).limit(5),
      ]);

      const projects = projectsRes.data || [];
      const totalIncome = incomeRes.data?.reduce((s: number, r: any) => s + r.amount, 0) || 0;
      const totalMf = incomeRes.data?.reduce((s: number, r: any) => s + r.management_fee_amount, 0) || 0;
      const totalExpenses = expensesRes.data?.reduce((s: number, e: any) => s + e.amount, 0) || 0;
      const totalVendorPayments = vendorPaymentsRes.data?.reduce((s: number, p: any) => s + p.amount, 0) || 0;

      setStats({
        activeProjects: projects.filter((p: any) => p.project_status === 'active').length,
        totalProjects: projects.length,
        totalIncome,
        totalMf,
        totalExpenses,
        totalVendorPayments,
        netCash: totalIncome - totalExpenses - totalVendorPayments,
        activeClients: clientsRes.data?.length || 0,
        activeVendors: vendorsRes.data?.length || 0,
        recentIncome: (recentIncomeRes.data || []).map((r: any) => ({
          income_number: r.income_number,
          amount: r.amount,
          payment_date: r.payment_date,
          project_code: r.project?.project_code,
        })),
        recentExpenses: (recentExpensesRes.data || []).map((e: any) => ({
          expense_number: e.expense_number,
          amount: e.amount,
          expense_date: e.expense_date,
          description: e.description,
        })),
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD', minimumFractionDigits: 2 }).format(amount);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Overview of your project management and financials</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-50">
              <FolderKanban className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Active Projects</h3>
          <p className="text-2xl font-bold text-slate-900">{stats.activeProjects}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.totalProjects} total</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-50">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Total Income</h3>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalIncome)}</p>
          <p className="text-xs text-slate-500 mt-1">MF: {formatCurrency(stats.totalMf)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-red-50">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Total Outflow</h3>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalExpenses + stats.totalVendorPayments)}</p>
          <p className="text-xs text-slate-500 mt-1">Expenses + Vendor Payments</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-teal-50">
              <DollarSign className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Net Cash</h3>
          <p className={`text-2xl font-bold ${stats.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(stats.netCash)}</p>
          <p className="text-xs text-slate-500 mt-1">Income - All Outflows</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-600" />
                <span className="text-slate-700">Active Clients</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">{stats.activeClients}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-slate-600" />
                <span className="text-slate-700">Active Vendors</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">{stats.activeVendors}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-slate-600" />
                <span className="text-slate-700">Management Fee</span>
              </div>
              <span className="text-lg font-semibold text-blue-600">{formatCurrency(stats.totalMf)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-5 h-5 text-slate-600" />
                <span className="text-slate-700">Vendor Payments</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">{formatCurrency(stats.totalVendorPayments)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Income</h2>
          <div className="space-y-3">
            {stats.recentIncome.length === 0 ? (
              <p className="text-sm text-slate-500">No income recorded yet.</p>
            ) : stats.recentIncome.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-900">{r.income_number}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(r.payment_date).toLocaleDateString()}
                    {r.project_code && <span className="ml-1 text-blue-600">{r.project_code}</span>}
                  </div>
                </div>
                <span className="text-sm font-bold text-green-600">{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Expenses</h2>
          <div className="space-y-3">
            {stats.recentExpenses.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses recorded yet.</p>
            ) : stats.recentExpenses.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-900">{e.expense_number}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(e.expense_date).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-sm font-bold text-red-600">{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
