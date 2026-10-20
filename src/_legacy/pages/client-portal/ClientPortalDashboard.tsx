import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import FileViewer, { type Attachment } from '../../components/common/FileViewer';
import {
  Building2, LayoutDashboard, DollarSign, CreditCard, Wallet, FileCheck,
  LogOut, Menu, TrendingUp, TrendingDown, Scale, ChevronRight, Calendar,
  CheckCircle2, Clock, X, Paperclip, FileText, Image as ImageIcon,
  ExternalLink, Search, Receipt, Eye,
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
  management_fee_amount: number;
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
  expense_type: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  vendor_id: string | null;
  management_fee_percent: number | null;
  source_income_id: string | null;
  project?: { project_code: string; project_name: string } | null;
  vendor?: { name: string } | null;
}

interface VendorPaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  client_amount: number;
  office_amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  vendor?: { name: string } | null;
  project?: { project_code: string; project_name: string } | null;
}

interface QuotationLine {
  id: string;
  item_description: string;
  profession: string;
  quantity: number;
  measurement_unit: string;
  rate_for_client: number;
  total_amount_client: number;
}

interface QuotationRecord {
  id: string;
  quotation_number: string;
  quotation_date: string;
  description: string | null;
  status: string;
  valid_until: string | null;
  notes: string | null;
  total_amount: number;
  vendor?: { name: string } | null;
  project?: { project_code: string; project_name: string } | null;
  lines?: QuotationLine[];
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

  // Search states (debounced)
  const [expenseSearch, setExpenseSearch] = useState('');
  const [quotationSearch, setQuotationSearch] = useState('');
  const [debouncedExpenseSearch, setDebouncedExpenseSearch] = useState('');
  const [debouncedQuotationSearch, setDebouncedQuotationSearch] = useState('');

  // FileViewer state
  const [viewerAttachments, setViewerAttachments] = useState<Attachment[]>([]);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [viewerTitle, setViewerTitle] = useState('');
  const [showViewer, setShowViewer] = useState(false);

  // Quotation detail modal
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationRecord | null>(null);
  const [quotationAttachments, setQuotationAttachments] = useState<Attachment[]>([]);
  const [loadingQuotationAttachments, setLoadingQuotationAttachments] = useState(false);

  // Debounce search inputs
  useEffect(() => {
    const t = setTimeout(() => setDebouncedExpenseSearch(expenseSearch), 300);
    return () => clearTimeout(t);
  }, [expenseSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuotationSearch(quotationSearch), 300);
    return () => clearTimeout(t);
  }, [quotationSearch]);

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
      if (projectIds.length === 0) { setLoading(false); return; }

      const [incomeRes, expensesRes, paymentsRes, quotationsRes] = await Promise.all([
        supabase.from('project_income')
          .select('id, income_number, payment_date, amount, management_fee_amount, payment_method, notes, project:projects(project_code, project_name)')
          .in('project_id', projectIds)
          .order('payment_date', { ascending: false }),
        supabase.from('project_expenses')
          .select('id, expense_number, expense_date, description, amount, category, expense_type, status, payment_method, notes, vendor_id, management_fee_percent, source_income_id, project:projects(project_code, project_name), vendor:vendors(name)')
          .in('project_id', projectIds)
          .eq('status', 'confirmed')
          .order('expense_date', { ascending: false }),
        supabase.from('vendor_project_payments')
          .select('id, payment_number, payment_date, amount, client_amount, office_amount, payment_method, reference, notes, vendor:vendors(name), project:projects(project_code, project_name)')
          .in('project_id', projectIds)
          .gt('client_amount', 0)
          .order('payment_date', { ascending: false }),
        supabase.from('vendor_quotations')
          .select('id, quotation_number, quotation_date, description, status, valid_until, notes, total_amount, vendor:vendors(name), project:projects(project_code, project_name), lines:quotation_lines(id, item_description, profession, quantity, measurement_unit, rate_for_client, total_amount_client)')
          .in('project_id', projectIds)
          .order('quotation_date', { ascending: false }),
      ]);

      setIncome(incomeRes.data || []);
      setExpenses(expensesRes.data || []);
      setVendorPayments(paymentsRes.data || []);
      setQuotations(quotationsRes.data || []);
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
      if (selectedQuotation?.id === quotationId) {
        setSelectedQuotation(prev => prev ? { ...prev, status: 'approved' } : prev);
      }
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

  const fetchAttachments = useCallback(async (entityType: string, entityId: string): Promise<Attachment[]> => {
    const { data, error } = await supabase
      .from('attachments')
      .select('id, kind, file_name, file_path, file_size, mime_type, external_url')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (error) { console.error('Error loading attachments:', error); return []; }
    return (data || []) as Attachment[];
  }, []);

  const openExpenseViewer = async (expense: ExpenseRecord) => {
    const entityType = expense.expense_type === 'site_expense' ? 'site_expense' : 'general_expense';
    const atts = await fetchAttachments(entityType, expense.id);
    setViewerAttachments(atts);
    setViewerStartIndex(0);
    setViewerTitle(`Receipt — ${expense.expense_number}`);
    setShowViewer(true);
  };

  const openQuotationViewer = async (quotation: QuotationRecord) => {
    setSelectedQuotation(quotation);
    setQuotationAttachments([]);
    setLoadingQuotationAttachments(true);
    try {
      const atts = await fetchAttachments('vendor_quotation', quotation.id);
      setQuotationAttachments(atts);
    } finally {
      setLoadingQuotationAttachments(false);
    }
  };

  const openQuotationAttachmentViewer = (startIndex: number) => {
    if (quotationAttachments.length === 0) return;
    setViewerAttachments(quotationAttachments);
    setViewerStartIndex(startIndex);
    setViewerTitle(`Attachments — ${selectedQuotation?.quotation_number || ''}`);
    setShowViewer(true);
  };

  const downloadAttachment = async (att: Attachment) => {
    if (att.kind === 'link' && att.external_url) {
      window.open(att.external_url, '_blank');
      return;
    }
    if (!att.file_path) return;
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(att.file_path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error getting file URL:', error);
      alert('Failed to load file');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (date: string) => new Date(date).toLocaleDateString();

  // Filtered expenses (debounced search)
  const filteredExpenses = useMemo(() => {
    if (!debouncedExpenseSearch.trim()) return expenses;
    const q = debouncedExpenseSearch.toLowerCase();
    return expenses.filter(e =>
      (e.expense_number || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      String(e.amount).includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.expense_date || '').includes(q) ||
      (e.vendor?.name || '').toLowerCase().includes(q) ||
      (e.notes || '').toLowerCase().includes(q) ||
      (e.payment_method || '').toLowerCase().includes(q) ||
      (e.project?.project_name || '').toLowerCase().includes(q) ||
      (e.project?.project_code || '').toLowerCase().includes(q)
    );
  }, [expenses, debouncedExpenseSearch]);

  // Filtered quotations (debounced search across all fields including line items)
  const filteredQuotations = useMemo(() => {
    if (!debouncedQuotationSearch.trim()) return quotations;
    const q = debouncedQuotationSearch.toLowerCase();
    return quotations.filter(qu => {
      const lineMatch = (qu.lines || []).some(l =>
        (l.item_description || '').toLowerCase().includes(q) ||
        (l.profession || '').toLowerCase().includes(q)
      );
      return (
        (qu.quotation_number || '').toLowerCase().includes(q) ||
        (qu.description || '').toLowerCase().includes(q) ||
        (qu.status || '').toLowerCase().includes(q) ||
        (qu.notes || '').toLowerCase().includes(q) ||
        (qu.vendor?.name || '').toLowerCase().includes(q) ||
        (qu.project?.project_name || '').toLowerCase().includes(q) ||
        (qu.project?.project_code || '').toLowerCase().includes(q) ||
        (qu.quotation_date || '').includes(q) ||
        String(qu.total_amount).includes(q) ||
        lineMatch
      );
    });
  }, [quotations, debouncedQuotationSearch]);

  const managementFeeExpenses = useMemo(() =>
    expenses.filter(e => e.expense_type === 'management_fee'),
    [expenses]
  );

  const regularExpenses = useMemo(() =>
    expenses.filter(e => e.expense_type !== 'management_fee'),
    [expenses]
  );

  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalManagementFees = managementFeeExpenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalVendorPayments = vendorPayments.reduce((s, r) => s + Number(r.client_amount || 0), 0);
  const outstandingBalance = totalIncome - totalExpenses - totalVendorPayments;

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

      {/* Quotation Detail Modal */}
      {selectedQuotation && renderQuotationModal()}

      {/* Full-screen File Viewer */}
      {showViewer && (
        <FileViewer
          attachments={viewerAttachments}
          startIndex={viewerStartIndex}
          onClose={() => setShowViewer(false)}
          title={viewerTitle}
        />
      )}
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

        {totalManagementFees > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">Management Fees Auto-Deducted</p>
              <p className="text-xs text-amber-700">{formatCurrency(totalManagementFees)} has been automatically deducted from your income as management fee expenses.</p>
            </div>
          </div>
        )}

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
                    <p className="text-xs text-slate-500">{formatDate(r.payment_date)}</p>
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
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Mgmt Fee</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {income.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">No income records found.</td></tr>
              ) : income.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{r.income_number}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDate(r.payment_date)}</div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{r.project?.project_name || '-'}</td>
                  <td className="px-5 py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{(r.payment_method || '').replace('_', ' ')}</span></td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-green-700">{formatCurrency(Number(r.amount))}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-amber-700">{Number(r.management_fee_amount) > 0 ? formatCurrency(Number(r.management_fee_amount)) : '-'}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[200px] truncate">{r.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
            {income.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-sm font-bold text-slate-900 text-right">Total</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-green-700">{formatCurrency(totalIncome)}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-amber-700">{formatCurrency(totalManagementFees)}</td>
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
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={expenseSearch}
            onChange={(e) => setExpenseSearch(e.target.value)}
            placeholder="Search expenses by number, description, amount, vendor, category, date, project, notes..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

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
                  <th className="text-center px-5 py-3 text-xs font-medium text-slate-600 uppercase">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">{debouncedExpenseSearch ? 'No expenses match your search.' : 'No expense records found.'}</td></tr>
                ) : filteredExpenses.map(e => {
                  const isMF = e.expense_type === 'management_fee';
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{e.expense_number}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDate(e.expense_date)}</div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-900 max-w-[200px] truncate">{e.description}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{e.project?.project_name || '-'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isMF && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap">
                              Auto - Management Fee
                            </span>
                          )}
                          {!isMF && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize whitespace-nowrap">
                              {e.category || (e.expense_type === 'site' ? 'Site Expense' : 'General Expense')}
                            </span>
                          )}
                          {isMF && e.management_fee_percent != null && (
                            <span className="text-xs text-amber-600">({Number(e.management_fee_percent)}%)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-red-700">{formatCurrency(Number(e.amount))}</td>
                      <td className="px-5 py-3.5 text-center">
                        {!isMF && (
                          <button
                            onClick={() => openExpenseViewer(e)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition"
                          >
                            <Receipt className="w-3.5 h-3.5" /> View
                          </button>
                        )}
                        {isMF && <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredExpenses.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-sm font-bold text-slate-900 text-right">Total</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-red-700">{formatCurrency(filteredExpenses.reduce((s, e) => s + Number(e.amount), 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Management fees are automatically deducted from project income. Click "View" to open the receipt viewer with support for images, PDFs, video, and audio.
        </p>
      </div>
    );
  }

  function renderVendorPayments() {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Showing only client-portion payments. Office-portion payments are excluded.
        </div>
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
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Client Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorPayments.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No client payments found.</td></tr>
                ) : vendorPayments.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{r.payment_number}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDate(r.payment_date)}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-900">{r.vendor?.name || '-'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{r.project?.project_name || '-'}</td>
                    <td className="px-5 py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{(r.payment_method || '').replace('_', ' ')}</span></td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">{formatCurrency(Number(r.client_amount || 0))}</td>
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
      </div>
    );
  }

  function renderQuotations() {
    return (
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={quotationSearch}
            onChange={(e) => setQuotationSearch(e.target.value)}
            placeholder="Search quotations by number, vendor, project, line items, description, status, notes..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        <p className="text-sm text-slate-600">View and approve quotations for your projects. Click a quotation to see line items and open attachments in the multi-format viewer.</p>

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
                  <th className="text-center px-5 py-3 text-xs font-medium text-slate-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">{debouncedQuotationSearch ? 'No quotations match your search.' : 'No quotations found.'}</td></tr>
                ) : filteredQuotations.map(q => {
                  const clientTotal = (q.lines || []).reduce((s, l) => s + Number(l.total_amount_client), 0);
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-slate-50/50 cursor-pointer transition"
                      onClick={() => openQuotationViewer(q)}
                    >
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{q.quotation_number}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{formatDate(q.quotation_date)}</td>
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
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
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

  function renderQuotationModal() {
    if (!selectedQuotation) return null;
    const clientTotal = (selectedQuotation.lines || []).reduce((s, l) => s + Number(l.total_amount_client), 0);

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedQuotation(null)}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{selectedQuotation.quotation_number}</h3>
                <p className="text-xs text-slate-500">{selectedQuotation.vendor?.name} - {selectedQuotation.project?.project_code}</p>
              </div>
            </div>
            <button onClick={() => setSelectedQuotation(null)} className="p-2 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Date</p>
                <p className="text-sm text-slate-900">{formatDate(selectedQuotation.quotation_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Valid Until</p>
                <p className="text-sm text-slate-900">{selectedQuotation.valid_until ? formatDate(selectedQuotation.valid_until) : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Status</p>
                {selectedQuotation.status === 'approved' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3" />Approved
                  </span>
                ) : selectedQuotation.status === 'rejected' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <Clock className="w-3 h-3" />Pending
                  </span>
                )}
              </div>
            </div>

            {selectedQuotation.description && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Description</p>
                <p className="text-sm text-slate-900">{selectedQuotation.description}</p>
              </div>
            )}

            {/* Line Items */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Line Items</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-600">Description</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-600">Qty</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-600">Unit</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-600">Rate</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedQuotation.lines || []).map(line => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {line.item_description}
                          {line.profession && <p className="text-xs text-slate-500 mt-0.5">{line.profession}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{Number(line.quantity)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{line.measurement_unit}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{formatCurrency(Number(line.rate_for_client))}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">{formatCurrency(Number(line.total_amount_client))}</td>
                      </tr>
                    ))}
                    {(!selectedQuotation.lines || selectedQuotation.lines.length === 0) && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No line items</td></tr>
                    )}
                  </tbody>
                  {selectedQuotation.lines && selectedQuotation.lines.length > 0 && (
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-900 text-right">Client Total</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(clientTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {selectedQuotation.notes && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Notes</p>
                <p className="text-sm text-slate-600">{selectedQuotation.notes}</p>
              </div>
            )}

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-medium text-slate-500 uppercase">Attachments ({quotationAttachments.length})</p>
                </div>
                {quotationAttachments.length > 0 && (
                  <button
                    onClick={() => openQuotationAttachmentViewer(0)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Open Viewer
                  </button>
                )}
              </div>
              {loadingQuotationAttachments ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                  Loading attachments...
                </div>
              ) : quotationAttachments.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No attachments</p>
              ) : (
                <div className="space-y-2">
                  {quotationAttachments.map((att, idx) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
                    >
                      {att.kind === 'link' ? (
                        <ExternalLink className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      ) : att.mime_type?.startsWith('image/') ? (
                        <ImageIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{att.file_name}</p>
                        <p className="text-xs text-slate-500">
                          {att.kind === 'link' ? 'External link' : att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : 'File'}
                        </p>
                      </div>
                      <button
                        onClick={() => openQuotationAttachmentViewer(idx)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-blue-50 text-blue-600 text-xs font-medium rounded transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        onClick={() => downloadAttachment(att)}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-400 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approve Button */}
            {selectedQuotation.status === 'pending' && (
              <button
                onClick={() => handleApproveQuotation(selectedQuotation.id)}
                disabled={approving === selectedQuotation.id}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
              >
                {approving === selectedQuotation.id ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Approving...</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> Approve Quotation</>
                )}
              </button>
            )}
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
