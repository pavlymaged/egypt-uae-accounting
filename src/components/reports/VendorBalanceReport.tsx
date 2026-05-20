import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Search, DollarSign, TrendingDown, Download } from 'lucide-react';

interface VendorBalance {
  vendor_id: string;
  vendor_name: string;
  total_quotations: number;
  total_payments: number;
  outstanding: number;
}

export default function VendorBalanceReport() {
  const { currentOrganization } = useOrganization();
  const [balances, setBalances] = useState<VendorBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentOrganization) fetchData();
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    try {
      const { data: vendors } = await supabase.from('vendors').select('id, name').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
      const { data: quotations } = await supabase.from('vendor_quotations').select('vendor_id, total_amount').eq('organization_id', currentOrganization.id).eq('status', 'approved');
      const { data: payments } = await supabase.from('vendor_project_payments').select('vendor_id, amount').eq('organization_id', currentOrganization.id);

      const qMap: Record<string, number> = {};
      quotations?.forEach(q => { qMap[q.vendor_id] = (qMap[q.vendor_id] || 0) + q.total_amount; });
      const pMap: Record<string, number> = {};
      payments?.forEach(p => { pMap[p.vendor_id] = (pMap[p.vendor_id] || 0) + p.amount; });

      setBalances((vendors || []).map(v => ({
        vendor_id: v.id,
        vendor_name: v.name,
        total_quotations: qMap[v.id] || 0,
        total_payments: pMap[v.id] || 0,
        outstanding: (qMap[v.id] || 0) - (pMap[v.id] || 0),
      })));
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);
  const totalOutstanding = balances.reduce((s, b) => s + b.outstanding, 0);
  const totalPaid = balances.reduce((s, b) => s + b.total_payments, 0);
  const filtered = balances.filter(b => b.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()));

  const exportToCSV = () => {
    const headers = ['Vendor', 'Approved Quotations', 'Total Paid', 'Outstanding'];
    const rows = filtered.map(b => [
      `"${b.vendor_name}"`, b.total_quotations.toFixed(2), b.total_payments.toFixed(2), b.outstanding.toFixed(2),
    ]);
    rows.push(['Total', filtered.reduce((s, b) => s + b.total_quotations, 0).toFixed(2), filtered.reduce((s, b) => s + b.total_payments, 0).toFixed(2), filtered.reduce((s, b) => s + b.outstanding, 0).toFixed(2)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-balance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Vendor Balance Report</h1>
          <p className="text-slate-600">Outstanding balances owed to vendors</p>
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Outstanding</span><TrendingDown className="w-5 h-5 text-red-600" /></div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Paid</span><DollarSign className="w-5 h-5 text-green-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalPaid)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search vendors..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Approved Quotations</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Total Paid</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-600">No data found.</td></tr>
              ) : (
                <>
                  {filtered.map(b => (
                    <tr key={b.vendor_id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{b.vendor_name}</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600">{formatCurrency(b.total_quotations)}</td>
                      <td className="px-6 py-4 text-right text-sm text-green-600">{formatCurrency(b.total_payments)}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <span className={b.outstanding > 0 ? 'text-red-600' : 'text-slate-900'}>{formatCurrency(b.outstanding)}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-6 py-4 text-sm text-slate-900">Total</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-900">{formatCurrency(filtered.reduce((s, b) => s + b.total_quotations, 0))}</td>
                    <td className="px-6 py-4 text-right text-sm text-green-600">{formatCurrency(filtered.reduce((s, b) => s + b.total_payments, 0))}</td>
                    <td className="px-6 py-4 text-right text-sm text-red-600">{formatCurrency(filtered.reduce((s, b) => s + b.outstanding, 0))}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
