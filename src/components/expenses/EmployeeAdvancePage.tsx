import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, Banknote, DollarSign, Download, Paperclip, HardHat } from 'lucide-react';
import AttachmentsManager from '../attachments/AttachmentsManager';

interface EmployeeAdvance {
  id: string;
  advance_number: string;
  advance_date: string;
  employee_name: string;
  amount: number;
  source_account: string;
  remaining_balance: number;
  notes: string | null;
  linked_engineer_id?: string | null;
}

interface Props {
  prefillEngineer?: { id: string; name: string; email: string; phone: string };
  onClearPrefill?: () => void;
}

export default function EmployeeAdvancePage({ prefillEngineer, onClearPrefill }: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmployeeAdvance | null>(null);
  const [prefillActive, setPrefillActive] = useState(false);
  const [linkedEngineerId, setLinkedEngineerId] = useState<string | null>(null);

  const defaultForm = {
    advance_date: new Date().toISOString().split('T')[0],
    employee_name: '',
    amount: 0,
    source_account: 'cash',
    notes: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (currentOrganization) fetchAdvances();
  }, [currentOrganization]);

  useEffect(() => {
    if (prefillEngineer) {
      setFormData({
        advance_date: new Date().toISOString().split('T')[0],
        employee_name: prefillEngineer.name,
        amount: 0,
        source_account: 'cash',
        notes: `Advance for engineer: ${prefillEngineer.name}`,
      });
      setLinkedEngineerId(prefillEngineer.id);
      setPrefillActive(true);
      setEditing(null);
      setShowModal(true);
    }
  }, [prefillEngineer]);

  const fetchAdvances = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('employee_advances')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('advance_date', { ascending: false });
      if (error) throw error;
      setAdvances(data || []);
      const ids = (data || []).map(d => d.id);
      if (ids.length) {
        const { data: atts } = await supabase
          .from('attachments').select('entity_id')
          .eq('entity_type', 'employee_advance').in('entity_id', ids);
        const counts: Record<string, number> = {};
        (atts || []).forEach((a: { entity_id: string }) => { counts[a.entity_id] = (counts[a.entity_id] || 0) + 1; });
        setAttachmentCounts(counts);
      } else setAttachmentCounts({});
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'ADV-0001';
    const { data } = await supabase
      .from('employee_advances')
      .select('advance_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) return 'ADV-0001';
    const match = data[0].advance_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `ADV-${String(next).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    try {
      if (editing) {
        const { error } = await supabase.from('employee_advances').update({
          advance_date: formData.advance_date,
          employee_name: formData.employee_name,
          amount: formData.amount,
          remaining_balance: formData.amount,
          source_account: formData.source_account,
          notes: formData.notes,
        }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const num = await generateNumber();
        const { data: inserted, error } = await supabase.from('employee_advances').insert([{
          advance_number: num,
          advance_date: formData.advance_date,
          employee_name: formData.employee_name,
          amount: formData.amount,
          remaining_balance: formData.amount,
          source_account: formData.source_account,
          notes: formData.notes,
          organization_id: currentOrganization.id,
          created_by: user.id,
          linked_engineer_id: linkedEngineerId || null,
        }]).select('*').single();
        if (error) throw error;
        await fetchAdvances();
        if (inserted) { setEditing(inserted as EmployeeAdvance); return; }
      }
      await fetchAdvances();
      handleCloseModal();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save advance');
    }
  };

  const handleEdit = (advance: EmployeeAdvance) => {
    setEditing(advance);
    setFormData({
      advance_date: advance.advance_date,
      employee_name: advance.employee_name,
      amount: advance.amount,
      source_account: advance.source_account,
      notes: advance.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (advance: EmployeeAdvance) => {
    if (!confirm(`Delete advance ${advance.advance_number}?`)) return;
    const { error } = await supabase.from('employee_advances').delete().eq('id', advance.id);
    if (!error) await fetchAdvances();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData(defaultForm);
    setLinkedEngineerId(null);
    setPrefillActive(false);
    if (onClearPrefill) onClearPrefill();
  };

  const exportToCSV = () => {
    const headers = ['Number', 'Date', 'Employee', 'Source', 'Amount', 'Remaining'];
    const rows = advances.map(a => [
      a.advance_number, a.advance_date, `"${a.employee_name}"`,
      a.source_account, a.amount.toFixed(2), a.remaining_balance.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-advances-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = advances.filter(a =>
    a.advance_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.employee_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAdvances = advances.reduce((s, a) => s + a.amount, 0);
  const totalRemaining = advances.reduce((s, a) => s + a.remaining_balance, 0);
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  if (loading) {
    return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Employee Advances</h1>
          <p className="text-slate-600">Transfer money from bank or cash for employee spending</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
            <Plus className="w-5 h-5" />New Advance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Advances</span><Banknote className="w-5 h-5 text-blue-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalAdvances)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Remaining Balance</span><DollarSign className="w-5 h-5 text-amber-600" /></div>
          <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalRemaining)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Spent</span><DollarSign className="w-5 h-5 text-green-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalAdvances - totalRemaining)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search advances..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Employee</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Source</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Remaining</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-600">No advances found.</td></tr>
              ) : filtered.map((advance) => (
                <tr key={advance.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {advance.advance_number}
                      {attachmentCounts[advance.id] > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${attachmentCounts[advance.id]} attachment(s)`}>
                          <Paperclip className="w-3 h-3" />{attachmentCounts[advance.id]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(advance.advance_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{advance.employee_name}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">{advance.source_account.replace('_', ' ')}</span></td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(advance.amount)}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <span className={advance.remaining_balance > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {formatCurrency(advance.remaining_balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(advance)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(advance)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-2xl font-bold text-slate-900">{editing ? 'Edit Advance' : 'New Employee Advance'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {prefillActive && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <HardHat className="w-4 h-4 text-amber-700" />
                  <span className="text-sm text-amber-800 font-medium">Pre-filled from engineer record: {prefillEngineer?.name}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Employee Name *</label>
                <input type="text" value={formData.employee_name} onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <input type="date" value={formData.advance_date} onChange={(e) => setFormData({ ...formData, advance_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Source Account *</label>
                <select value={formData.source_account} onChange={(e) => setFormData({ ...formData, source_account: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="other">Other</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">This will reduce the available cash/bank balance and increase employee advance balance.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              {currentOrganization && (
                <div className="pt-2 border-t border-slate-200">
                  <AttachmentsManager organizationId={currentOrganization.id} entityType="employee_advance" entityId={editing?.id || null} />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">{editing ? 'Update' : 'Create Advance'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
