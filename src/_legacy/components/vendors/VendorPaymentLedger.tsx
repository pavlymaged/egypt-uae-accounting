import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Lock, Radio, HardHat, User, Calendar, FileText, Building2 } from 'lucide-react';

interface OfficePayment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  office_amount: number;
  client_amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  vendor?: { id: string; name: string } | null;
  project?: { project_code: string; project_name: string } | null;
  creator?: { email: string } | null;
}

interface ApprovedExpense {
  id: string;
  expense_number: string;
  expense_date: string;
  description: string;
  amount: number;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  reviewed_at: string | null;
  vendor?: { name: string } | null;
  project?: { project_code: string; project_name: string } | null;
}

interface VendorBalance {
  vendorId: string;
  vendorName: string;
  totalOfficePayments: number;
  totalClientPayments: number;
  balance: number;
}

export default function VendorPaymentLedger() {
  const { currentOrganization } = useOrganization();
  const [officePayments, setOfficePayments] = useState<OfficePayment[]>([]);
  const [approvedExpenses, setApprovedExpenses] = useState<ApprovedExpense[]>([]);
  const [vendorBalances, setVendorBalances] = useState<VendorBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncActive, setSyncActive] = useState(false);

  useEffect(() => {
    if (!currentOrganization) return;

    fetchOfficePayments();
    fetchApprovedExpenses();

    const paymentsChannel = supabase
      .channel('vendor-payments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_project_payments',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          fetchOfficePayments();
        }
      )
      .subscribe((status) => {
        setSyncActive(status === 'SUBSCRIBED');
      });

    const expensesChannel = supabase
      .channel('approved-expenses-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_expenses',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          fetchApprovedExpenses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, [currentOrganization]);

  useEffect(() => {
    computeVendorBalances();
  }, [officePayments]);

  const fetchOfficePayments = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('vendor_project_payments')
        .select('*, vendor:vendors(id, name), project:projects(project_code, project_name)')
        .eq('organization_id', currentOrganization.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setOfficePayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedExpenses = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('project_expenses')
        .select('*, vendor:vendors(name), project:projects(project_code, project_name)')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'confirmed')
        .eq('expense_type', 'site')
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setApprovedExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const computeVendorBalances = () => {
    const map: Record<string, VendorBalance> = {};
    officePayments.forEach((p) => {
      if (!p.vendor) return;
      const key = p.vendor.id;
      if (!map[key]) {
        map[key] = {
          vendorId: key,
          vendorName: p.vendor.name,
          totalOfficePayments: 0,
          totalClientPayments: 0,
          balance: 0,
        };
      }
      map[key].totalOfficePayments += Number(p.office_amount || 0);
      map[key].totalClientPayments += Number(p.client_amount || 0);
    });
    Object.values(map).forEach((v) => {
      v.balance = v.totalClientPayments - v.totalOfficePayments;
    });
    setVendorBalances(Object.values(map));
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentOrganization?.base_currency || 'USD',
    }).format(amount);

  const totalOffice = officePayments.reduce((s, p) => s + Number(p.office_amount || 0), 0);
  const totalClient = officePayments.reduce((s, p) => s + Number(p.client_amount || 0), 0);
  const totalExpenses = approvedExpenses.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Vendor Payment Ledger</h1>
          <p className="text-slate-600">Read-only real-time view of office payments and approved expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-medium text-slate-600">
            <Lock className="w-3.5 h-3.5" />
            Read-Only
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${syncActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <span className={`w-2 h-2 rounded-full ${syncActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <Radio className="w-3.5 h-3.5" />
            {syncActive ? 'Live Sync' : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Office Payments</span>
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalOffice)}</div>
          <div className="text-xs text-slate-500 mt-1">{officePayments.length} records</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Client Payments (Dummy)</span>
            <User className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalClient)}</div>
          <div className="text-xs text-slate-500 mt-1">Balance adjustment entries</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Approved Site Expenses</span>
            <HardHat className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</div>
          <div className="text-xs text-slate-500 mt-1">{approvedExpenses.length} approved entries</div>
        </div>
      </div>

      {/* Office Payments Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Office Payment Records</h2>
            <p className="text-sm text-slate-500">Synced in real-time from payment entries</p>
          </div>
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
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Office Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Reference</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officePayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      No office payment records found.
                    </td>
                  </tr>
                ) : (
                  officePayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{p.payment_number}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(p.payment_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-900">{p.vendor?.name || '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{p.project?.project_code || '-'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                          {(p.payment_method || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(Number(p.office_amount || p.amount || 0))}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[140px] truncate">{p.reference || '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[180px] truncate">{p.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Client Payment (Dummy) Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
            <User className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Client Payment (Balance Adjustment)</h2>
            <p className="text-sm text-slate-500">Virtual entries reflecting vendor balance per client - auto-calculated from office payments</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs font-medium text-amber-700">
            <FileText className="w-3.5 h-3.5" />
            Dummy / Non-transactional
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Total Client Payments</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Total Office Payments</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Vendor Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorBalances.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                      No vendor balance data. Balances auto-calculate from office payment records.
                    </td>
                  </tr>
                ) : (
                  vendorBalances.map((v) => (
                    <tr key={v.vendorId} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{v.vendorName}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-700">{formatCurrency(v.totalClientPayments)}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-slate-700">{formatCurrency(v.totalOfficePayments)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-sm font-bold ${v.balance > 0 ? 'text-amber-700' : v.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(v.balance)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {vendorBalances.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-5 py-3 text-sm font-bold text-slate-900">Totals</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(totalClient)}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(totalOffice)}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(totalClient - totalOffice)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      {/* Approved Site Expenses Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Approved Site Expenses</h2>
            <p className="text-sm text-slate-500">All confirmed expenses from the Expense Review module - synced in real-time</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Expense #</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-600 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      No approved site expenses found.
                    </td>
                  </tr>
                ) : (
                  approvedExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{e.expense_number}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(e.expense_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-900 max-w-[200px] truncate">{e.description}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{e.vendor?.name || '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{e.project?.project_code || '-'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                          {e.category || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">{formatCurrency(Number(e.amount))}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[180px] truncate">{e.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {approvedExpenses.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={6} className="px-5 py-3 text-sm font-bold text-slate-900 text-right">Total Approved Expenses</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(totalExpenses)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
