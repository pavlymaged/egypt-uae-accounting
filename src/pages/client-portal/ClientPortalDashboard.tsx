import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2, LayoutDashboard, DollarSign, CreditCard, Wallet, FileCheck,
  LogOut, Menu, TrendingUp, TrendingDown, Scale, ChevronRight, Calendar,
  CheckCircle2, Clock
} from 'lucide-react';

type PortalPage = 'overview' | 'income' | 'expenses' | 'vendor-payments' | 'quotations';

interface ClientInfo {
  id: string;
  name: string;
  customer_number: string;
  organization_id: string;
}

interface IncomeRecord {
  id: string;
  income_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  project?: { project_code: string; project_name: string } | null;
}

interface ExpenseRecord {
  id: string;
  expense_number: string;
  expense_date: string;
  description: string;
  amount: number;
  category: string | null;
  status: string;
  project?: { project_code: string; project_name: string } | null;
}

interface VendorPaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  client_amount: number;
  payment_method: string;
  vendor?: { name: string } | null;
  project?: { project_code: string; project_name: string } | null;
}

interface QuotationRecord {
  id: string;
  quotation_number: string;
  quotation_date: string;
  description: string | null;
  status: string;
  project?: { project_code: string; project_name: string } | null;
  vendor?: { name: string } | null;
  lines?: { total_amount_client: number }[];
}

interface PortalDashboardProps {
  onLogout: () => void;
}

export default function ClientPortalDashboard({ onLogout }: PortalDashboardProps) {
  const [currentPage, setCurrentPage] = useState<PortalPage>('overview');
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [income, setIncome] = useState<IncomeRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPaymentRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: portalUser } = await supabase
        .from('client_portal_users')
        .select('customer_id, organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!portalUser) return;

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, customer_number, organization_id')
        .eq('id', portalUser.customer_id)
        .maybeSingle();

      if (!customer) return;
      setClientInfo(customer);

      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', customer.id);

      const projectIds = (projects || []).map(p => p.id);

      if (projectIds.length > 0) {
        const [incomeRes, expensesRes, paymentsRes, quotationsRes] = await Promise.all([
          supabase.from('project_income')
            .select('*, project:projects(project_code, project_name)')
            .in('project_id', projectIds)
            .order('payment_date', { ascending: false }),
          supabase.from('project_expenses')
            .select('*, project:projects(project_code, project_name)')
            .in('project_id', projectIds)
            .eq('status', 'confirmed')
            .order('expense_date', { ascending: false }),
          supabase.from('vendor_project_payments')
            .select('*, vendor:vendors(name), project:projects(project_code, project_name)')
            .in('project_id', projectIds)
            .order('payment_date', { ascending: false }),
          supabase.from('vendor_quotations')
            .select('*, vendor:vendors(name), project:projects(project_code, project_name), lines:quotation_lines(total_amount_client)')
            .in('project_id', projectIds)
            .order('quotation_date', { ascending: false }),
        ]);

        setIncome(incomeRes.data || []);
        setExpenses(expensesRes.data || []);
        setVendorPayments(paymentsRes.data || []);
        setQuotations(quotationsRes.data || []);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuotation = async (quotationId: string) => {
    setApproving(quotationId);
    try {
      const { error } = await supabase
        .from('vendor_quotations')
        .update({ status: 'approved' })
        .eq('id', quotationId);
      if (error) throw error;
      setQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: 'approved' } : q));
    } catch (error) {
      console.error('Error approving quotation:', error);
      alert('Failed to approve quotation');
    } finally {
      setApproving(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalVendorPayments = vendorPayments.reduce((s, r) => s + Number(r.client_amount || r.amount), 0);
  const outstandingBalance = totalIncome - totalExpenses - totalVendorPayments;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const navItems = [
    { id: 'overview' as PortalPage, label: 'Overview', icon: LayoutDashboard },
    { id: 'income' as PortalPage, label: 'Income', icon: DollarSign },
    { id: 'expenses' as PortalPage, label: 'Expenses', icon: CreditCard },
    { id: 'vendor-payments' as PortalPage, label: 'Vendor Payments', icon: Wallet },
    { id: 'quotations' as PortalPage, label: 'Quotations', icon: FileCheck },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 transition-transform duration-300 flex flex-col`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white truncate">{clientInfo?.name || 'Client Portal'}</p>
              <p className="text-xs text-slate-400">{clientInfo?.customer_number}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setCurrentPage(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                currentPage === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 capitalize">{currentPage === 'vendor-payments' ? 'Vendor Payments' : currentPage}</h2>
          </div>
        </header>

        <div className="p-6">
          {currentPage === 'overview' && renderOverview()}
          {currentPage === 'income' && renderIncome()}
          {currentPage === 'expenses' && renderExpenses()}
          {currentPage === 'vendor-payments' && renderVendorPayments()}
          {currentPage === 'quotations' && renderQuotations()}
        </div>
      </main>
    </div>
  );

  function renderOverview() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={TrendingUp} label="Total Income" value={formatCurrency(totalIncome)} color="green" />
          <SummaryCard icon={TrendingDown} label="Total Expenses" value={formatCurrency(totalExpenses)} color="red" />
          <SummaryCard icon={Wallet} label="Vendor Payments" value={formatCurrency(totalVendorPayments)} color="blue" />
          <SummaryCard icon={Scale} label="Outstanding Balance" value={formatCurrency(outstandingBalance)} color={outstandingBalance >= 0 ? 'green' : 'amber'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Recent Income</h3>
              <button onClick={() => setCurrentPage('income')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="space-y-3">
              {income.slice(0, 4).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.project?.project_name || r.income_number}</p>
                    <p className="text-xs text-slate-500">{new Date(r.payment_date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">+{formatCurrency(Number(r.amount))}</span>
                </div>
              ))}
              {income.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No income records</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Pending Quotations</h3>
              <button onClick={() => setCurrentPage('quotations')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="space-y-3">
              {quotations.filter(q => q.status === 'pending').slice(0, 4).map(q => {
                const clientTotal = (q.lines || []).reduce((s, l) => s + Number(l.total_amount_client), 0);
                return (
                  <div key={q.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{q.quotation_number}</p>
                      <p className="text-xs text-slate-500">{q.vendor?.name} - {q.project?.project_code}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(clientTotal)}</span>
                  </div>
                );
              })}
              {quotations.filter(q => q.status === 'pending').length === 0 && <p className="text-sm text-slate-500 text-center py-4">No pending quotations</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderIncome() {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Method</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {income.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No income records found.</td></tr>
              ) : income.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{r.income_number}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{new Date(r.payment_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{r.project?.project_name || '-'}</td>
                  <td className="px-5 py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{(r.payment_method || '').replace('_', ' ')}</span></td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-green-700">{formatCurrency(Number(r.amount))}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[200px] truncate">{r.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
            {income.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-sm font-bold text-slate-900 text-right">Total</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-green-700">{formatCurrency(totalIncome)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  function renderExpenses() {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No expense records found.</td></tr>
              ) : expenses.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{r.expense_number}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{new Date(r.expense_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-900 max-w-[200px] truncate">{r.description}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{r.project?.project_name || '-'}</td>
                  <td className="px-5 py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{r.category || '-'}</span></td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-red-700">{formatCurrency(Number(r.amount))}</td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-sm font-bold text-slate-900 text-right">Total</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-red-700">{formatCurrency(totalExpenses)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  function renderVendorPayments() {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Payment #</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Method</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorPayments.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No vendor payments found.</td></tr>
              ) : vendorPayments.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{r.payment_number}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{new Date(r.payment_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-900">{r.vendor?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{r.project?.project_name || '-'}</td>
                  <td className="px-5 py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{(r.payment_method || '').replace('_', ' ')}</span></td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">{formatCurrency(Number(r.client_amount || r.amount))}</td>
                </tr>
              ))}
            </tbody>
            {vendorPayments.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-sm font-bold text-slate-900 text-right">Total</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(totalVendorPayments)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  function renderQuotations() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">View and approve quotations for your projects. Amounts shown are client-facing rates.</p>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Quotation #</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No quotations found.</td></tr>
                ) : quotations.map(q => {
                  const clientTotal = (q.lines || []).reduce((s, l) => s + Number(l.total_amount_client), 0);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{q.quotation_number}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{new Date(q.quotation_date).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-900">{q.vendor?.name || '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{q.project?.project_name || '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[160px] truncate">{q.description || '-'}</td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">{formatCurrency(clientTotal)}</td>
                      <td className="px-5 py-3.5">
                        {q.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" />Approved
                          </span>
                        ) : q.status === 'rejected' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {q.status === 'pending' && (
                          <button
                            onClick={() => handleApproveQuotation(q.id)}
                            disabled={approving === q.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
                          >
                            {approving === q.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const iconColorMap: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium opacity-80">{label}</span>
        <Icon className={`w-5 h-5 ${iconColorMap[color] || iconColorMap.blue}`} />
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
