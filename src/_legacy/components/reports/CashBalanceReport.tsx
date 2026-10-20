import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Download } from 'lucide-react';

interface CashSummary {
  totalIncome: number;
  totalGeneralExpenses: number;
  totalSiteExpenses: number;
  totalVendorPayments: number;
  netCash: number;
  incomeByMethod: Record<string, number>;
  expensesByMethod: Record<string, number>;
}

export default function CashBalanceReport() {
  const { currentOrganization } = useOrganization();
  const [summary, setSummary] = useState<CashSummary>({
    totalIncome: 0, totalGeneralExpenses: 0, totalSiteExpenses: 0,
    totalVendorPayments: 0, netCash: 0, incomeByMethod: {}, expensesByMethod: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) fetchData();
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    try {
      const { data: income } = await supabase.from('project_income').select('amount, payment_method').eq('organization_id', currentOrganization.id);
      const { data: expenses } = await supabase.from('project_expenses').select('amount, payment_method, expense_type').eq('organization_id', currentOrganization.id);
      const { data: vendorPayments } = await supabase.from('vendor_project_payments').select('amount, payment_method').eq('organization_id', currentOrganization.id);

      const totalIncome = income?.reduce((s, r) => s + r.amount, 0) || 0;
      const totalGeneralExpenses = expenses?.filter(e => e.expense_type === 'general').reduce((s, e) => s + e.amount, 0) || 0;
      const totalSiteExpenses = expenses?.filter(e => e.expense_type === 'site').reduce((s, e) => s + e.amount, 0) || 0;
      const totalVendorPayments = vendorPayments?.reduce((s, p) => s + p.amount, 0) || 0;

      const incomeByMethod: Record<string, number> = {};
      income?.forEach(r => { incomeByMethod[r.payment_method] = (incomeByMethod[r.payment_method] || 0) + r.amount; });

      const expensesByMethod: Record<string, number> = {};
      expenses?.forEach(e => { if (e.payment_method) expensesByMethod[e.payment_method] = (expensesByMethod[e.payment_method] || 0) + e.amount; });
      vendorPayments?.forEach(p => { expensesByMethod[p.payment_method] = (expensesByMethod[p.payment_method] || 0) + p.amount; });

      setSummary({
        totalIncome, totalGeneralExpenses, totalSiteExpenses, totalVendorPayments,
        netCash: totalIncome - totalGeneralExpenses - totalSiteExpenses - totalVendorPayments,
        incomeByMethod, expensesByMethod,
      });
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);
  const methodLabel = (m: string) => m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  const exportToCSV = () => {
    const rows: string[][] = [
      ['Category', 'Amount'],
      ['Total Income', summary.totalIncome.toFixed(2)],
      ['General Expenses', summary.totalGeneralExpenses.toFixed(2)],
      ['Site Expenses', summary.totalSiteExpenses.toFixed(2)],
      ['Vendor Payments', summary.totalVendorPayments.toFixed(2)],
      ['Net Cash Position', summary.netCash.toFixed(2)],
      [''],
      ['Income by Method', 'Amount'],
      ...Object.entries(summary.incomeByMethod).map(([m, a]) => [methodLabel(m), a.toFixed(2)]),
      [''],
      ['Outflows by Method', 'Amount'],
      ...Object.entries(summary.expensesByMethod).map(([m, a]) => [methodLabel(m), a.toFixed(2)]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-balance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Cash Balance Report</h1>
          <p className="text-slate-600">Overview of all cash flow across the organization</p>
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Income</span><TrendingUp className="w-5 h-5 text-green-600" /></div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">General Expenses</span><TrendingDown className="w-5 h-5 text-red-600" /></div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalGeneralExpenses)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Site Expenses</span><TrendingDown className="w-5 h-5 text-amber-600" /></div>
          <div className="text-2xl font-bold text-amber-600">{formatCurrency(summary.totalSiteExpenses)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Vendor Payments</span><DollarSign className="w-5 h-5 text-red-600" /></div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalVendorPayments)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">Net Cash Position</h2>
        </div>
        <div className={`text-4xl font-bold ${summary.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(summary.netCash)}
        </div>
        <p className="text-sm text-slate-600 mt-2">Income - (General Expenses + Site Expenses + Vendor Payments)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Income by Payment Method</h2>
          <div className="space-y-3">
            {Object.entries(summary.incomeByMethod).length === 0 ? (
              <p className="text-slate-600 text-sm">No income recorded yet.</p>
            ) : Object.entries(summary.incomeByMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700 capitalize">{methodLabel(method)}</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Outflows by Payment Method</h2>
          <div className="space-y-3">
            {Object.entries(summary.expensesByMethod).length === 0 ? (
              <p className="text-slate-600 text-sm">No outflows recorded yet.</p>
            ) : Object.entries(summary.expensesByMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700 capitalize">{methodLabel(method)}</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
