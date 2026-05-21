import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, ArrowRightLeft, DollarSign } from 'lucide-react';

interface CashTransfer {
  id: string;
  transfer_number: string;
  transfer_date: string;
  from_account: string;
  to_account: string;
  amount: number;
  reference: string | null;
  notes: string | null;
}

interface ActiveEmployee {
  id: string;
  name: string;
  balance: number;
}

export default function CashTransferPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CashTransfer | null>(null);

  const [formData, setFormData] = useState({
    transfer_date: new Date().toISOString().split('T')[0],
    from_account: '',
    to_account: '',
    amount: 0,
    reference: '',
    notes: '',
  });

  useEffect(() => {
    if (currentOrganization) {
      fetchTransfers();
      fetchActiveEmployees();
    }
  }, [currentOrganization]);

  const fetchTransfers = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase.from('cash_transfers').select('*').eq('organization_id', currentOrganization.id).order('transfer_date', { ascending: false });
      if (error) throw error;
      setTransfers(data || []);
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const fetchActiveEmployees = async () => {
    if (!currentOrganization) return;
    const { data: engineersList } = await supabase
      .from('site_engineers')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .eq('is_active', true)
      .order('name');

    if (!engineersList || engineersList.length === 0) {
      setEmployees([]);
      return;
    }

    const ids = engineersList.map(e => e.id);
    const { data: advances } = await supabase
      .from('engineer_advances')
      .select('engineer_id, amount')
      .in('engineer_id', ids);
    const { data: expenses } = await supabase
      .from('engineer_expenses')
      .select('engineer_id, amount')
      .in('engineer_id', ids)
      .eq('status', 'Approved');

    const balMap: Record<string, number> = {};
    ids.forEach(id => { balMap[id] = 0; });
    (advances || []).forEach(a => { balMap[a.engineer_id] = (balMap[a.engineer_id] || 0) + Number(a.amount); });
    (expenses || []).forEach(e => { balMap[e.engineer_id] = (balMap[e.engineer_id] || 0) - Number(e.amount); });

    setEmployees(engineersList.map(eng => ({ id: eng.id, name: eng.name, balance: balMap[eng.id] || 0 })));
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'TRF-0001';
    const { data } = await supabase.from('cash_transfers').select('transfer_number').eq('organization_id', currentOrganization.id).order('created_at', { ascending: false }).limit(1);
    if (!data || data.length === 0) return 'TRF-0001';
    const match = data[0].transfer_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `TRF-${String(next).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    try {
      if (editing) {
        const { error } = await supabase.from('cash_transfers').update({
          transfer_date: formData.transfer_date, from_account: formData.from_account,
          to_account: formData.to_account, amount: formData.amount,
          reference: formData.reference, notes: formData.notes,
        }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const num = await generateNumber();
        const { error } = await supabase.from('cash_transfers').insert([{
          transfer_number: num, transfer_date: formData.transfer_date,
          from_account: formData.from_account, to_account: formData.to_account,
          amount: formData.amount, reference: formData.reference,
          notes: formData.notes, organization_id: currentOrganization.id, created_by: user.id,
        }]);
        if (error) throw error;
      }
      await fetchTransfers();
      handleCloseModal();
    } catch (error) { console.error('Error:', error); alert('Failed to save transfer'); }
  };

  const handleEdit = (t: CashTransfer) => {
    setEditing(t);
    setFormData({ transfer_date: t.transfer_date, from_account: t.from_account, to_account: t.to_account, amount: t.amount, reference: t.reference || '', notes: t.notes || '' });
    setShowModal(true);
  };

  const handleDelete = async (t: CashTransfer) => {
    if (!confirm(`Delete transfer ${t.transfer_number}?`)) return;
    const { error } = await supabase.from('cash_transfers').delete().eq('id', t.id);
    if (!error) await fetchTransfers();
  };

  const handleCloseModal = () => {
    setShowModal(false); setEditing(null);
    setFormData({ transfer_date: new Date().toISOString().split('T')[0], from_account: '', to_account: '', amount: 0, reference: '', notes: '' });
  };

  const getAccountLabel = (value: string) => {
    if (value === 'cash') return 'Cash';
    if (value === 'bank') return 'Bank';
    const emp = employees.find(e => `employee:${e.id}` === value);
    return emp ? emp.name : value;
  };

  const filtered = transfers.filter(t =>
    t.transfer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.from_account.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.to_account.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTransferred = transfers.reduce((s, t) => s + t.amount, 0);
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Cash Transfers</h1>
          <p className="text-slate-600">Transfer cash between accounts</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"><Plus className="w-5 h-5" />New Transfer</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Transferred</span><ArrowRightLeft className="w-5 h-5 text-blue-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalTransferred)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Transfers</span><DollarSign className="w-5 h-5 text-green-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{transfers.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search transfers..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">From</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">To</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Reference</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-600">No transfers found.</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.transfer_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(t.transfer_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{getAccountLabel(t.from_account)}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{getAccountLabel(t.to_account)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{t.reference || '-'}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(t.amount)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(t)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(t)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
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
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">{editing ? 'Edit Transfer' : 'New Cash Transfer'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Transfer Date *</label>
                <input type="date" value={formData.transfer_date} onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">From Account *</label>
                  <select value={formData.from_account} onChange={(e) => setFormData({ ...formData, from_account: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="">Select account...</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    {employees.length > 0 && (
                      <optgroup label="Employees">
                        {employees.map(emp => (
                          <option key={emp.id} value={`employee:${emp.id}`}>
                            {emp.name} — Balance: {formatCurrency(emp.balance)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">To Account *</label>
                  <select value={formData.to_account} onChange={(e) => setFormData({ ...formData, to_account: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="">Select account...</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    {employees.length > 0 && (
                      <optgroup label="Employees">
                        {employees.map(emp => (
                          <option key={emp.id} value={`employee:${emp.id}`}>
                            {emp.name} — Balance: {formatCurrency(emp.balance)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount *</label>
                <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Reference</label>
                <input type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">{editing ? 'Update' : 'Create Transfer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
