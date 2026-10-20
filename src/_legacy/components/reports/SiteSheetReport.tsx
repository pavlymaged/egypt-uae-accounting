import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { FolderKanban, DollarSign, TrendingUp, TrendingDown, Download } from 'lucide-react';

interface ProjectSheet {
  id: string;
  project_code: string;
  project_name: string;
  project_status: string;
  management_fee_percent: number;
  totalIncome: number;
  totalMf: number;
  generalExpenses: number;
  siteExpenses: number;
  vendorPayments: number;
  net: number;
}

export default function SiteSheetReport() {
  const { currentOrganization } = useOrganization();
  const [sheets, setSheets] = useState<ProjectSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    if (currentOrganization) fetchData();
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    try {
      const { data: projects } = await supabase.from('projects').select('id, project_code, project_name, project_status, management_fee_percent').eq('organization_id', currentOrganization.id).order('project_code');
      const { data: income } = await supabase.from('project_income').select('project_id, amount, management_fee_amount').eq('organization_id', currentOrganization.id);
      const { data: expenses } = await supabase.from('project_expenses').select('project_id, amount, expense_type').eq('organization_id', currentOrganization.id);
      const { data: vendorPayments } = await supabase.from('vendor_project_payments').select('project_id, amount').eq('organization_id', currentOrganization.id);

      const incMap: Record<string, { income: number; mf: number }> = {};
      income?.forEach(i => {
        if (!incMap[i.project_id]) incMap[i.project_id] = { income: 0, mf: 0 };
        incMap[i.project_id].income += i.amount;
        incMap[i.project_id].mf += i.management_fee_amount;
      });

      const expMap: Record<string, { general: number; site: number }> = {};
      expenses?.forEach(e => {
        if (!e.project_id) return;
        if (!expMap[e.project_id]) expMap[e.project_id] = { general: 0, site: 0 };
        if (e.expense_type === 'general') expMap[e.project_id].general += e.amount;
        else expMap[e.project_id].site += e.amount;
      });

      const vpMap: Record<string, number> = {};
      vendorPayments?.forEach(p => { if (p.project_id) vpMap[p.project_id] = (vpMap[p.project_id] || 0) + p.amount; });

      setSheets((projects || []).map(p => {
        const inc = incMap[p.id] || { income: 0, mf: 0 };
        const exp = expMap[p.id] || { general: 0, site: 0 };
        const vp = vpMap[p.id] || 0;
        return {
          ...p,
          totalIncome: inc.income,
          totalMf: inc.mf,
          generalExpenses: exp.general,
          siteExpenses: exp.site,
          vendorPayments: vp,
          net: inc.income - inc.mf - exp.general - exp.site - vp,
        };
      }));
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);
  const displayed = selectedProject ? sheets.filter(s => s.id === selectedProject) : sheets;

  const exportToCSV = () => {
    const headers = ['Project Code', 'Project Name', 'Status', 'MF %', 'Income', 'MF Collected', 'General Exp', 'Site Exp', 'Vendor Payments', 'Project Balance'];
    const rows = displayed.map(s => [
      s.project_code, `"${s.project_name}"`, s.project_status, s.management_fee_percent,
      s.totalIncome.toFixed(2), s.totalMf.toFixed(2), s.generalExpenses.toFixed(2),
      s.siteExpenses.toFixed(2), s.vendorPayments.toFixed(2), s.net.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-sheet-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Site Sheet Report</h1>
          <p className="text-slate-600">Financial summary per project</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Projects</option>
            {sheets.map(s => <option key={s.id} value={s.id}>{s.project_code} - {s.project_name}</option>)}
          </select>
          <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-600">No projects found.</div>
        ) : displayed.map(sheet => (
          <div key={sheet.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FolderKanban className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-slate-900">{sheet.project_code} - {sheet.project_name}</h3>
                    <p className="text-sm text-slate-600">MF: {sheet.management_fee_percent}% | Status: {sheet.project_status}</p>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${sheet.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(sheet.net)}
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600 mb-1">Income</div>
                  <div className="text-sm font-bold text-green-600">{formatCurrency(sheet.totalIncome)}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600 mb-1">MF Collected</div>
                  <div className="text-sm font-bold text-blue-600">{formatCurrency(sheet.totalMf)}</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600 mb-1">General Exp</div>
                  <div className="text-sm font-bold text-red-600">{formatCurrency(sheet.generalExpenses)}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600 mb-1">Site Exp</div>
                  <div className="text-sm font-bold text-amber-600">{formatCurrency(sheet.siteExpenses)}</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600 mb-1">Vendor Payments</div>
                  <div className="text-sm font-bold text-red-600">{formatCurrency(sheet.vendorPayments)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
