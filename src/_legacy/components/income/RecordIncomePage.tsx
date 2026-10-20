import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, Calendar, DollarSign, TrendingUp, Paperclip } from 'lucide-react';
import AttachmentsManager from '../attachments/AttachmentsManager';

interface IncomeRecord {
  id: string;
  income_number: string;
  project_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  received_by: string | null;
  notes: string | null;
  management_fee_amount: number;
  project?: { project_code: string; project_name: string; management_fee_percent: number; management_fee_on_income_percent: number };
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  management_fee_percent: number;
  management_fee_on_income_percent: number;
}

export default function RecordIncomePage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<IncomeRecord | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [formData, setFormData] = useState({
    project_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'cash',
    received_by: '',
    notes: '',
  });

  useEffect(() => {
    if (currentOrganization) {
      fetchRecords();
      fetchProjects();
    }
  }, [currentOrganization]);

  const fetchRecords = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('project_income')
        .select('*, project:projects(project_code, project_name, management_fee_percent, management_fee_on_income_percent)')
        .eq('organization_id', currentOrganization.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      setRecords(data || []);
      const ids = (data || []).map(d => d.id);
      if (ids.length) {
        const { data: atts } = await supabase
          .from('attachments').select('entity_id')
          .eq('entity_type', 'project_income').in('entity_id', ids);
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

  const fetchProjects = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_code, project_name, management_fee_percent, management_fee_on_income_percent')
        .eq('organization_id', currentOrganization.id)
        .eq('project_status', 'active')
        .order('project_code');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'INC-0001';
    const { data } = await supabase
      .from('project_income')
      .select('income_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) return 'INC-0001';
    const match = data[0].income_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `INC-${String(next).padStart(4, '0')}`;
  };

  const calcMfAmount = (amount: number, mfOnIncomePercent: number) => {
    return (amount * mfOnIncomePercent) / 100;
  };

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId) || null;
    setSelectedProject(project);
    setFormData({ ...formData, project_id: projectId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user || !selectedProject) return;
    try {
      if (editing) {
        const { error } = await supabase
          .from('project_income')
          .update({
            project_id: formData.project_id,
            payment_date: formData.payment_date,
            amount: formData.amount,
            payment_method: formData.payment_method,
            received_by: formData.received_by,
            notes: formData.notes,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const num = await generateNumber();
        const { data: inserted, error } = await supabase.from('project_income').insert([{
          income_number: num,
          project_id: formData.project_id,
          payment_date: formData.payment_date,
          amount: formData.amount,
          payment_method: formData.payment_method,
          received_by: formData.received_by,
          notes: formData.notes,
          organization_id: currentOrganization.id,
          created_by: user.id,
        }]).select('*, project:projects(project_code, project_name, management_fee_percent, management_fee_on_income_percent)').single();
        if (error) throw error;
        await fetchRecords();
        if (inserted) { setEditing(inserted as IncomeRecord); return; }
      }
      await fetchRecords();
      handleCloseModal();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save income record');
    }
  };

  const handleEdit = (record: IncomeRecord) => {
    setEditing(record);
    const project = projects.find(p => p.id === record.project_id) || null;
    setSelectedProject(project);
    setFormData({
      project_id: record.project_id,
      payment_date: record.payment_date,
      amount: record.amount,
      payment_method: record.payment_method,
      received_by: record.received_by || '',
      notes: record.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (record: IncomeRecord) => {
    if (!confirm(`Delete income record ${record.income_number}?`)) return;
    try {
      const { error } = await supabase.from('project_income').delete().eq('id', record.id);
      if (error) throw error;
      await fetchRecords();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setSelectedProject(null);
    setFormData({ project_id: '', payment_date: new Date().toISOString().split('T')[0], amount: 0, payment_method: 'cash', received_by: '', notes: '' });
  };

  const filtered = records.filter(r =>
    r.income_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.project?.project_code && r.project.project_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.project?.project_name && r.project.project_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalIncome = records.reduce((s, r) => s + r.amount, 0);
  const totalMf = records.reduce((s, r) => s + r.management_fee_amount, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Record Income</h1>
          <p className="text-slate-600">Track income received for projects</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
          <Plus className="w-5 h-5" />
          Record Income
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Income</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Management Fee</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalMf)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">This Month</span>
            <Calendar className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(records.filter(r => new Date(r.payment_date).getMonth() === new Date().getMonth() && new Date(r.payment_date).getFullYear() === new Date().getFullYear()).reduce((s, r) => s + r.amount, 0))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by number or project..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Payment Method</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Received By</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">MF Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-600">No income records found.</td></tr>
              ) : (
                filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {record.income_number}
                        {attachmentCounts[record.id] > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${attachmentCounts[record.id]} attachment(s)`}>
                            <Paperclip className="w-3 h-3" />{attachmentCounts[record.id]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(record.payment_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="font-medium">{record.project?.project_code}</div>
                      <div className="text-xs text-slate-500">{record.project?.project_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">{record.payment_method.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{record.received_by || '-'}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(record.amount)}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">{formatCurrency(record.management_fee_amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(record)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(record)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">{editing ? 'Edit Income' : 'Record New Income'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Project *</label>
                <select value={formData.project_id} onChange={(e) => handleProjectSelect(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select a project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                </select>
              </div>

              {selectedProject && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
                  <div className="text-sm"><span className="font-medium text-blue-800">Project:</span> <span className="text-blue-700">{selectedProject.project_name}</span></div>
                  <div className="text-sm"><span className="font-medium text-blue-800">Management Fee:</span> <span className="text-blue-700">{selectedProject.management_fee_percent}%</span></div>
                  <div className="text-sm"><span className="font-medium text-blue-800">MF on Income:</span> <span className="text-blue-700">{selectedProject.management_fee_on_income_percent.toFixed(4)}%</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date *</label>
                  <input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method *</label>
                  <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Received By</label>
                  <input type="text" value={formData.received_by} onChange={(e) => setFormData({ ...formData, received_by: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {selectedProject && formData.amount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-800">
                    Management Fee on this Income: {formatCurrency(calcMfAmount(formData.amount, selectedProject.management_fee_on_income_percent))}
                  </div>
                  <p className="text-xs text-green-600 mt-1">{formatCurrency(formData.amount)} x {selectedProject.management_fee_on_income_percent.toFixed(4)}%</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>

              {currentOrganization && (
                <div className="pt-2 border-t border-slate-200">
                  <AttachmentsManager organizationId={currentOrganization.id} entityType="project_income" entityId={editing?.id || null} />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">{editing ? 'Update' : 'Record Income'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
