import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { CreditCard, Users, HardHat, ShoppingCart, TrendingDown, Download, Search, ChevronDown, ChevronRight } from 'lucide-react';

interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  project_code: string | null;
  source_label: string;
}

interface SectionData {
  label: string;
  icon: typeof CreditCard;
  iconColor: string;
  rows: ExpenseRow[];
  total: number;
}

export default function GeneralExpensesPage() {
  const { currentOrganization } = useOrganization();
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (currentOrganization) fetchAllExpenses();
  }, [currentOrganization, dateRange]);

  const fetchAllExpenses = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [employeeExpenses, siteExpenses, vendorPayments, directExpenses] = await Promise.all([
        fetchEmployeeExpenses(),
        fetchSiteExpenses(),
        fetchVendorPayments(),
        fetchDirectGeneralExpenses(),
      ]);

      setSections([
        {
          label: 'Employee Expenses',
          icon: Users,
          iconColor: 'text-blue-600',
          rows: employeeExpenses,
          total: employeeExpenses.reduce((s, r) => s + r.amount, 0),
        },
        {
          label: 'Site Expenses',
          icon: HardHat,
          iconColor: 'text-amber-600',
          rows: siteExpenses,
          total: siteExpenses.reduce((s, r) => s + r.amount, 0),
        },
        {
          label: 'Vendor Payments',
          icon: ShoppingCart,
          iconColor: 'text-teal-600',
          rows: vendorPayments,
          total: vendorPayments.reduce((s, r) => s + r.amount, 0),
        },
        {
          label: 'Direct General Expenses',
          icon: CreditCard,
          iconColor: 'text-red-600',
          rows: directExpenses,
          total: directExpenses.reduce((s, r) => s + r.amount, 0),
        },
      ]);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeExpenses = async (): Promise<ExpenseRow[]> => {
    if (!currentOrganization) return [];
    const { data } = await supabase
      .from('engineer_expenses')
      .select('id, expense_date, description, amount, category, project:projects(project_code), engineer:site_engineers(name)')
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'Approved')
      .gte('expense_date', dateRange.from)
      .lte('expense_date', dateRange.to)
      .order('expense_date', { ascending: false });

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.expense_date,
      description: row.description,
      amount: Number(row.amount),
      category: row.category || '-',
      project_code: row.project?.project_code || null,
      source_label: row.engineer?.name || 'Employee',
    }));
  };

  const fetchSiteExpenses = async (): Promise<ExpenseRow[]> => {
    if (!currentOrganization) return [];
    const { data } = await supabase
      .from('project_expenses')
      .select('id, expense_date, description, amount, category, project:projects(project_code)')
      .eq('organization_id', currentOrganization.id)
      .eq('expense_type', 'site')
      .gte('expense_date', dateRange.from)
      .lte('expense_date', dateRange.to)
      .order('expense_date', { ascending: false });

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.expense_date,
      description: row.description,
      amount: Number(row.amount),
      category: row.category || '-',
      project_code: row.project?.project_code || null,
      source_label: 'Site',
    }));
  };

  const fetchVendorPayments = async (): Promise<ExpenseRow[]> => {
    if (!currentOrganization) return [];
    const { data } = await supabase
      .from('vendor_payments')
      .select('id, payment_date, description, amount, vendor:vendors(name), project:projects(project_code)')
      .eq('organization_id', currentOrganization.id)
      .gte('payment_date', dateRange.from)
      .lte('payment_date', dateRange.to)
      .order('payment_date', { ascending: false });

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.payment_date,
      description: row.description || row.vendor?.name || 'Vendor Payment',
      amount: Number(row.amount),
      category: 'Vendor',
      project_code: row.project?.project_code || null,
      source_label: row.vendor?.name || 'Vendor',
    }));
  };

  const fetchDirectGeneralExpenses = async (): Promise<ExpenseRow[]> => {
    if (!currentOrganization) return [];
    const { data } = await supabase
      .from('project_expenses')
      .select('id, expense_date, description, amount, category, project:projects(project_code)')
      .eq('organization_id', currentOrganization.id)
      .eq('expense_type', 'general')
      .gte('expense_date', dateRange.from)
      .lte('expense_date', dateRange.to)
      .order('expense_date', { ascending: false });

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.expense_date,
      description: row.description,
      amount: Number(row.amount),
      category: row.category || '-',
      project_code: row.project?.project_code || null,
      source_label: 'Direct',
    }));
  };

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  const filterRows = (rows: ExpenseRow[]) => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r =>
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.source_label.toLowerCase().includes(q) ||
      (r.project_code && r.project_code.toLowerCase().includes(q))
    );
  };

  const exportToCSV = () => {
    const headers = ['Section', 'Date', 'Description', 'Category', 'Project', 'Source', 'Amount'];
    const rows: string[][] = [];
    sections.forEach(sec => {
      filterRows(sec.rows).forEach(r => {
        rows.push([sec.label, r.date, `"${r.description}"`, r.category, r.project_code || '', r.source_label, r.amount.toFixed(2)]);
      });
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-expenses-${dateRange.from}-to-${dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">General Expenses</h1>
          <p className="text-slate-600">Aggregate view of all expense categories</p>
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
          <Download className="w-4 h-4" />Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {sections.map(sec => {
          const Icon = sec.icon;
          return (
            <div key={sec.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{sec.label}</span>
                <Icon className={`w-4 h-4 ${sec.iconColor}`} />
              </div>
              <div className="text-xl font-bold text-slate-900">{formatCurrency(sec.total)}</div>
              <div className="text-xs text-slate-500 mt-1">{sec.rows.length} entries</div>
            </div>
          );
        })}
        <div className="bg-slate-900 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">Grand Total</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-bold">{formatCurrency(grandTotal)}</div>
          <div className="text-xs text-slate-400 mt-1">{sections.reduce((s, sec) => s + sec.rows.length, 0)} entries</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all expenses..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">From</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">To</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {sections.map(sec => {
            const Icon = sec.icon;
            const isCollapsed = collapsedSections[sec.label];
            const filteredRows = filterRows(sec.rows);

            return (
              <div key={sec.label}>
                <button
                  onClick={() => toggleSection(sec.label)}
                  className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition text-left"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  <Icon className={`w-5 h-5 ${sec.iconColor}`} />
                  <span className="font-semibold text-slate-900 flex-1">{sec.label}</span>
                  <span className="text-sm text-slate-500 mr-4">{filteredRows.length} items</span>
                  <span className="font-bold text-slate-900">{formatCurrency(sec.total)}</span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-6 py-2 text-xs font-medium text-slate-500 uppercase">Date</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-slate-500 uppercase">Description</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-slate-500 uppercase">Category</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-slate-500 uppercase">Project</th>
                          <th className="text-left px-6 py-2 text-xs font-medium text-slate-500 uppercase">Source</th>
                          <th className="text-right px-6 py-2 text-xs font-medium text-slate-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-6 text-center text-sm text-slate-500">No entries for this period.</td></tr>
                        ) : filteredRows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 text-sm text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-sm text-slate-900 max-w-xs truncate">{row.description}</td>
                            <td className="px-6 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">{row.category}</span></td>
                            <td className="px-6 py-3 text-sm text-slate-600">{row.project_code || '-'}</td>
                            <td className="px-6 py-3 text-sm text-slate-600">{row.source_label}</td>
                            <td className="px-6 py-3 text-right text-sm font-medium text-slate-900">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {filteredRows.length > 0 && (
                        <tfoot className="bg-slate-50">
                          <tr>
                            <td colSpan={5} className="px-6 py-2 text-sm font-medium text-slate-700 text-right">Subtotal</td>
                            <td className="px-6 py-2 text-right text-sm font-bold text-slate-900">{formatCurrency(filteredRows.reduce((s, r) => s + r.amount, 0))}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-slate-900 rounded-b-xl flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Grand Total</span>
          <span className="text-xl font-bold text-white">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
