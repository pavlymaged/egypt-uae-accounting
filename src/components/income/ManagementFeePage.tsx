import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { DollarSign, TrendingUp, Search } from 'lucide-react';

interface ProjectMfSummary {
  project_id: string;
  project_code: string;
  project_name: string;
  management_fee_percent: number;
  management_fee_on_income_percent: number;
  total_income: number;
  total_mf: number;
}

export default function ManagementFeePage() {
  const { currentOrganization } = useOrganization();
  const [summaries, setSummaries] = useState<ProjectMfSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentOrganization) fetchData();
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    try {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, project_code, project_name, management_fee_percent, management_fee_on_income_percent')
        .eq('organization_id', currentOrganization.id)
        .order('project_code');

      const { data: income } = await supabase
        .from('project_income')
        .select('project_id, amount, management_fee_amount')
        .eq('organization_id', currentOrganization.id);

      const incomeMap: Record<string, { total: number; mf: number }> = {};
      income?.forEach(i => {
        if (!incomeMap[i.project_id]) incomeMap[i.project_id] = { total: 0, mf: 0 };
        incomeMap[i.project_id].total += i.amount;
        incomeMap[i.project_id].mf += i.management_fee_amount;
      });

      setSummaries((projects || []).map(p => ({
        project_id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        management_fee_percent: p.management_fee_percent,
        management_fee_on_income_percent: p.management_fee_on_income_percent,
        total_income: incomeMap[p.id]?.total || 0,
        total_mf: incomeMap[p.id]?.mf || 0,
      })));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  const grandTotalIncome = summaries.reduce((s, r) => s + r.total_income, 0);
  const grandTotalMf = summaries.reduce((s, r) => s + r.total_mf, 0);

  const filtered = summaries.filter(s =>
    s.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Management Fee Summary</h1>
        <p className="text-slate-600">Overview of management fees collected across all projects</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Income (All Projects)</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(grandTotalIncome)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Management Fee Collected</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(grandTotalMf)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by project..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project Code</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">MF %</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">MF on Income %</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Total Income</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Total MF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-600">No data found.</td></tr>
              ) : (
                <>
                  {filtered.map((s) => (
                    <tr key={s.project_id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{s.project_code}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{s.project_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.management_fee_percent}%</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{s.management_fee_on_income_percent.toFixed(4)}%</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(s.total_income)}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">{formatCurrency(s.total_mf)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={4} className="px-6 py-4 text-sm text-slate-900">Total</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-900">{formatCurrency(filtered.reduce((s, r) => s + r.total_income, 0))}</td>
                    <td className="px-6 py-4 text-right text-sm text-blue-600">{formatCurrency(filtered.reduce((s, r) => s + r.total_mf, 0))}</td>
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
