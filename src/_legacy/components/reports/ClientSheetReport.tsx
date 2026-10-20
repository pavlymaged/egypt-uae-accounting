import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Users, FolderKanban, DollarSign, TrendingUp, Download } from 'lucide-react';

interface ClientSheet {
  client_id: string;
  client_name: string;
  projects: {
    id: string;
    project_code: string;
    project_name: string;
    totalIncome: number;
    totalMf: number;
    totalExpenses: number;
    vendorPayments: number;
  }[];
  totalIncome: number;
  totalMf: number;
  totalExpenses: number;
  totalVendorPayments: number;
}

export default function ClientSheetReport() {
  const { currentOrganization } = useOrganization();
  const [clientSheets, setClientSheets] = useState<ClientSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    if (currentOrganization) fetchData();
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;
    try {
      const { data: clients } = await supabase.from('customers').select('id, name').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
      const { data: projects } = await supabase.from('projects').select('id, project_code, project_name, client_id').eq('organization_id', currentOrganization.id);
      const { data: income } = await supabase.from('project_income').select('project_id, amount, management_fee_amount').eq('organization_id', currentOrganization.id);
      const { data: expenses } = await supabase.from('project_expenses').select('project_id, amount').eq('organization_id', currentOrganization.id);
      const { data: vendorPayments } = await supabase.from('vendor_project_payments').select('project_id, amount').eq('organization_id', currentOrganization.id);

      const incMap: Record<string, { inc: number; mf: number }> = {};
      income?.forEach(i => { if (!incMap[i.project_id]) incMap[i.project_id] = { inc: 0, mf: 0 }; incMap[i.project_id].inc += i.amount; incMap[i.project_id].mf += i.management_fee_amount; });
      const expMap: Record<string, number> = {};
      expenses?.forEach(e => { if (e.project_id) expMap[e.project_id] = (expMap[e.project_id] || 0) + e.amount; });
      const vpMap: Record<string, number> = {};
      vendorPayments?.forEach(p => { if (p.project_id) vpMap[p.project_id] = (vpMap[p.project_id] || 0) + p.amount; });

      const projectsByClient: Record<string, typeof projects> = {};
      projects?.forEach(p => {
        if (!projectsByClient[p.client_id]) projectsByClient[p.client_id] = [];
        projectsByClient[p.client_id]!.push(p);
      });

      setClientSheets((clients || []).map(c => {
        const clientProjects = (projectsByClient[c.id] || []).map(p => ({
          id: p.id,
          project_code: p.project_code,
          project_name: p.project_name,
          totalIncome: incMap[p.id]?.inc || 0,
          totalMf: incMap[p.id]?.mf || 0,
          totalExpenses: expMap[p.id] || 0,
          vendorPayments: vpMap[p.id] || 0,
        }));
        return {
          client_id: c.id,
          client_name: c.name,
          projects: clientProjects,
          totalIncome: clientProjects.reduce((s, p) => s + p.totalIncome, 0),
          totalMf: clientProjects.reduce((s, p) => s + p.totalMf, 0),
          totalExpenses: clientProjects.reduce((s, p) => s + p.totalExpenses, 0),
          totalVendorPayments: clientProjects.reduce((s, p) => s + p.vendorPayments, 0),
        };
      }).filter(c => c.projects.length > 0));
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);
  const displayed = selectedClient ? clientSheets.filter(c => c.client_id === selectedClient) : clientSheets;

  const exportToCSV = () => {
    const rows: string[][] = [['Client', 'Project Code', 'Project Name', 'Income', 'MF', 'Expenses', 'Vendor Payments']];
    displayed.forEach(c => {
      c.projects.forEach(p => {
        rows.push([`"${c.client_name}"`, p.project_code, `"${p.project_name}"`, p.totalIncome.toFixed(2), p.totalMf.toFixed(2), p.totalExpenses.toFixed(2), p.vendorPayments.toFixed(2)]);
      });
      rows.push([`"${c.client_name} - TOTAL"`, '', '', c.totalIncome.toFixed(2), c.totalMf.toFixed(2), c.totalExpenses.toFixed(2), c.totalVendorPayments.toFixed(2)]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-sheet-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Client Sheet Report</h1>
          <p className="text-slate-600">Financial summary per client with project breakdown</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Clients</option>
            {clientSheets.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
          </select>
          <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-600">No client data found.</div>
        ) : displayed.map(client => (
          <div key={client.client_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-slate-900">{client.client_name}</h3>
                    <p className="text-sm text-slate-600">{client.projects.length} project{client.projects.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-600">Total Income</div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(client.totalIncome)}</div>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600">Income</div>
                  <div className="text-sm font-bold text-green-600">{formatCurrency(client.totalIncome)}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600">MF Collected</div>
                  <div className="text-sm font-bold text-blue-600">{formatCurrency(client.totalMf)}</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600">Expenses</div>
                  <div className="text-sm font-bold text-red-600">{formatCurrency(client.totalExpenses)}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <div className="text-xs text-slate-600">Vendor Pmts</div>
                  <div className="text-sm font-bold text-amber-600">{formatCurrency(client.totalVendorPayments)}</div>
                </div>
              </div>

              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-600 uppercase">Project</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-slate-600 uppercase">Income</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-slate-600 uppercase">MF</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-slate-600 uppercase">Expenses</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-slate-600 uppercase">Vendor Pmts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {client.projects.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="text-sm font-medium text-blue-600">{p.project_code}</div>
                            <div className="text-xs text-slate-500">{p.project_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-green-600">{formatCurrency(p.totalIncome)}</td>
                      <td className="px-4 py-3 text-right text-sm text-blue-600">{formatCurrency(p.totalMf)}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-600">{formatCurrency(p.totalExpenses)}</td>
                      <td className="px-4 py-3 text-right text-sm text-amber-600">{formatCurrency(p.vendorPayments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
