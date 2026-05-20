import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, Calendar, DollarSign, HardHat, CheckCircle, Clock, Download, Paperclip, Eye } from 'lucide-react';
import AttachmentsManager from '../attachments/AttachmentsManager';
import ExpenseDetailsModal from './ExpenseDetailsModal';

interface ProjectExpense {
  id: string;
  expense_number: string;
  project_id: string | null;
  expense_date: string;
  description: string;
  amount: number;
  payment_method: string | null;
  vendor_id: string | null;
  category: string | null;
  profession: string | null;
  vendor_name_text: string | null;
  trn_text: string | null;
  tax_included: boolean;
  status: string | null;
  notes: string | null;
  project?: { project_code: string; project_name: string } | null;
  vendor?: { name: string } | null;
}

interface Project { id: string; project_code: string; project_name: string; }
interface Vendor { id: string; name: string; tax_registration_number: string | null; }
interface ServiceType { id: string; name: string; }
interface EmployeeAdvance { id: string; advance_number: string; employee_name: string; remaining_balance: number; }

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function SiteExpensesPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [employeeAdvances, setEmployeeAdvances] = useState<EmployeeAdvance[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProjectExpense | null>(null);
  const [viewing, setViewing] = useState<ProjectExpense | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const defaultForm = {
    project_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    payment_method: 'cash',
    vendor_id: '',
    category: 'material',
    profession: '',
    vendor_name_text: '',
    trn_text: '',
    tax_included: false,
    employee_advance_id: '',
    notes: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (currentOrganization) {
      fetchExpenses();
      fetchProjects();
      fetchVendors();
      fetchServiceTypes();
      fetchEmployeeAdvances();
    }
  }, [currentOrganization]);

  const fetchExpenses = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase.from('project_expenses')
        .select('*, project:projects(project_code, project_name), vendor:vendors(name)')
        .eq('organization_id', currentOrganization.id)
        .eq('expense_type', 'site')
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
      const ids = (data || []).map(d => d.id);
      if (ids.length) {
        const { data: atts } = await supabase
          .from('attachments').select('entity_id')
          .eq('entity_type', 'site_expense').in('entity_id', ids);
        const counts: Record<string, number> = {};
        (atts || []).forEach((a: { entity_id: string }) => { counts[a.entity_id] = (counts[a.entity_id] || 0) + 1; });
        setAttachmentCounts(counts);
      } else setAttachmentCounts({});
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('projects').select('id, project_code, project_name').eq('organization_id', currentOrganization.id).eq('project_status', 'active').order('project_code');
    setProjects(data || []);
  };

  const fetchVendors = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('vendors').select('id, name, tax_registration_number').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
    setVendors(data || []);
  };

  const fetchServiceTypes = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('service_types').select('id, name').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
    setServiceTypes(data || []);
  };

  const fetchEmployeeAdvances = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('employee_advances').select('id, advance_number, employee_name, remaining_balance').eq('organization_id', currentOrganization.id).order('advance_date', { ascending: false });
    setEmployeeAdvances((data || []).filter(a => a.remaining_balance > 0));
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'SEXP-0001';
    const { data } = await supabase.from('project_expenses').select('expense_number').eq('organization_id', currentOrganization.id).eq('expense_type', 'site').order('created_at', { ascending: false }).limit(1);
    if (!data || data.length === 0) return 'SEXP-0001';
    const match = data[0].expense_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `SEXP-${String(next).padStart(4, '0')}`;
  };

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setFormData({
      ...formData,
      vendor_id: vendorId,
      vendor_name_text: vendor?.name || '',
      trn_text: vendor?.tax_registration_number || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    setFeedback(null);

    const useAdvance = formData.payment_method === 'employee_advance';
    if (useAdvance && !formData.employee_advance_id) {
      setFeedback({ kind: 'error', message: 'Please select an employee advance to draw from.' });
      return;
    }
    const advance = employeeAdvances.find(a => a.id === formData.employee_advance_id);
    if (useAdvance && advance && !editing && formData.amount > advance.remaining_balance) {
      setFeedback({ kind: 'error', message: `Amount exceeds remaining advance balance (${formatCurrency(advance.remaining_balance)}).` });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        project_id: formData.project_id || null,
        expense_date: formData.expense_date,
        description: formData.description,
        amount: formData.amount,
        payment_method: formData.payment_method,
        vendor_id: formData.vendor_id || null,
        category: formData.category,
        profession: formData.profession,
        vendor_name_text: formData.vendor_name_text,
        trn_text: formData.trn_text,
        tax_included: formData.tax_included,
        employee_advance_id: useAdvance ? formData.employee_advance_id : null,
        notes: formData.notes,
      };

      if (editing) {
        const { error } = await supabase.from('project_expenses').update(payload).eq('id', editing.id);
        if (error) throw error;

        const oldAdvanceId = (editing as any).employee_advance_id;
        const newAdvanceId = useAdvance ? formData.employee_advance_id : null;
        if (oldAdvanceId && oldAdvanceId !== newAdvanceId) {
          const { data: oldAdv } = await supabase.from('employee_advances').select('remaining_balance, amount').eq('id', oldAdvanceId).maybeSingle();
          if (oldAdv) {
            const restored = Math.min(oldAdv.amount, (oldAdv.remaining_balance || 0) + editing.amount);
            await supabase.from('employee_advances').update({ remaining_balance: restored }).eq('id', oldAdvanceId);
          }
        }
        if (newAdvanceId && newAdvanceId !== oldAdvanceId && advance) {
          const newBalance = Math.max(0, advance.remaining_balance - formData.amount);
          await supabase.from('employee_advances').update({ remaining_balance: newBalance }).eq('id', newAdvanceId);
        } else if (newAdvanceId && newAdvanceId === oldAdvanceId && advance) {
          const diff = formData.amount - editing.amount;
          if (diff !== 0) {
            const newBalance = Math.max(0, advance.remaining_balance - diff);
            await supabase.from('employee_advances').update({ remaining_balance: newBalance }).eq('id', newAdvanceId);
          }
        }
      } else {
        const num = await generateNumber();
        const { error } = await supabase.from('project_expenses').insert([{
          ...payload,
          expense_number: num,
          expense_type: 'site',
          status: 'pending',
          organization_id: currentOrganization.id,
          created_by: user.id,
        }]);
        if (error) throw error;

        if (useAdvance && advance) {
          const newBalance = Math.max(0, advance.remaining_balance - formData.amount);
          await supabase.from('employee_advances').update({ remaining_balance: newBalance }).eq('id', advance.id);
        }

      }
      await fetchExpenses();
      await fetchEmployeeAdvances();
      handleCloseModal();
    } catch (error) {
      console.error('Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to save expense.';
      setFeedback({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (expense: ProjectExpense) => {
    if (!user) return;
    const { error } = await supabase.from('project_expenses').update({
      status: 'confirmed',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', expense.id);
    if (!error) await fetchExpenses();
  };

  const handleReject = async (expense: ProjectExpense) => {
    if (!user) return;
    const { error } = await supabase.from('project_expenses').update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', expense.id);
    if (!error) await fetchExpenses();
  };

  const handleEdit = (expense: ProjectExpense) => {
    setEditing(expense);
    setFormData({
      project_id: expense.project_id || '',
      expense_date: expense.expense_date,
      description: expense.description,
      amount: expense.amount,
      payment_method: expense.payment_method || 'cash',
      vendor_id: expense.vendor_id || '',
      category: (expense as any).category || 'material',
      profession: (expense as any).profession || '',
      vendor_name_text: (expense as any).vendor_name_text || '',
      trn_text: (expense as any).trn_text || '',
      tax_included: (expense as any).tax_included || false,
      employee_advance_id: (expense as any).employee_advance_id || '',
      notes: expense.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (expense: ProjectExpense) => {
    if (!confirm(`Delete expense ${expense.expense_number}?`)) return;
    try {
      const advanceId = (expense as ProjectExpense & { employee_advance_id?: string | null }).employee_advance_id;
      if (advanceId) {
        const { data: adv } = await supabase
          .from('employee_advances')
          .select('remaining_balance, amount')
          .eq('id', advanceId)
          .maybeSingle();
        if (adv) {
          const restored = Math.min(adv.amount, (adv.remaining_balance || 0) + expense.amount);
          await supabase.from('employee_advances').update({ remaining_balance: restored }).eq('id', advanceId);
        }
      }
      const { error } = await supabase.from('project_expenses').delete().eq('id', expense.id);
      if (error) throw error;
      await fetchExpenses();
      await fetchEmployeeAdvances();
    } catch (error) {
      console.error('Error deleting expense:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete expense.';
      alert(message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData(defaultForm);
    setFeedback(null);
  };

  const exportToCSV = () => {
    const headers = ['Number', 'Date', 'Description', 'Category', 'Profession', 'Project', 'Vendor', 'Payment Method', 'Status', 'Amount'];
    const rows = expenses.map(e => [
      e.expense_number, e.expense_date, `"${e.description}"`,
      e.category || '', e.profession || '',
      e.project ? e.project.project_code : '', e.vendor?.name || '',
      e.payment_method || '', e.status || '', e.amount.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = expenses
    .filter(e => statusFilter === 'all' || e.status === statusFilter)
    .filter(e =>
      e.expense_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.project?.project_code && e.project.project_code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingCount = expenses.filter(e => e.status === 'pending').length;
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Site Expenses</h1>
          <p className="text-slate-600">Submit and review on-site project expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"><Plus className="w-5 h-5" />Submit Expense</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Site Expenses</span><HardHat className="w-5 h-5 text-amber-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">This Month</span><Calendar className="w-5 h-5 text-blue-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(expenses.filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth()).reduce((s, e) => s + e.amount, 0))}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Pending Review</span><Clock className="w-5 h-5 text-yellow-600" /></div>
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Count</span><DollarSign className="w-5 h-5 text-green-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{expenses.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search expenses..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-600">No site expenses found.</td></tr>
              ) : filtered.map((expense) => (
                <tr
                  key={expense.id}
                  onClick={() => setViewing(expense)}
                  className="hover:bg-blue-50/50 cursor-pointer transition group"
                  title="Click to view details"
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {expense.expense_number}
                      {attachmentCounts[expense.id] > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${attachmentCounts[expense.id]} attachment(s)`}>
                          <Paperclip className="w-3 h-3" />{attachmentCounts[expense.id]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(expense.expense_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{expense.description}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{expense.project ? expense.project.project_code : '-'}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">{expense.category || '-'}</span></td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[expense.status || 'confirmed']}`}>{expense.status || 'confirmed'}</span></td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(expense.amount)}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewing(expense)} className="text-slate-600 hover:text-slate-900 p-2 hover:bg-slate-100 rounded transition" title="View details"><Eye className="w-4 h-4" /></button>
                      {expense.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(expense)} className="text-green-600 hover:text-green-700 p-2 hover:bg-green-50 rounded transition" title="Confirm"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => handleReject(expense)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition" title="Reject"><X className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => handleEdit(expense)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(expense)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <ExpenseDetailsModal
          expense={viewing}
          entityType="site_expense"
          currency={currentOrganization?.base_currency || 'USD'}
          onClose={() => setViewing(null)}
          onEdit={() => { const v = viewing; setViewing(null); handleEdit(v); }}
          onDelete={async () => { const v = viewing; setViewing(null); await handleDelete(v); }}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-2xl font-bold text-slate-900">{editing ? 'Edit Site Expense' : 'Submit Site Expense'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {feedback.message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Project *</label>
                <select value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <input type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="material">Material</option>
                    <option value="labour">Labour</option>
                    <option value="indirect">Indirect</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Profession</label>
                  <select value={formData.profession} onChange={(e) => setFormData({ ...formData, profession: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select profession</option>
                    {serviceTypes.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method *</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({
                    ...formData,
                    payment_method: e.target.value,
                    employee_advance_id: e.target.value === 'employee_advance' ? formData.employee_advance_id : '',
                  })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="card">Card</option>
                  <option value="employee_advance">Employee Advance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {formData.payment_method === 'employee_advance' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <label className="block text-sm font-medium text-amber-900">Draw from Employee Advance *</label>
                  {employeeAdvances.length === 0 ? (
                    <p className="text-xs text-amber-700">No advances with available balance. Create one in Employee Advances.</p>
                  ) : (
                    <select
                      value={formData.employee_advance_id}
                      onChange={(e) => setFormData({ ...formData, employee_advance_id: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    >
                      <option value="">Select advance</option>
                      {employeeAdvances.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.advance_number} - {a.employee_name} ({formatCurrency(a.remaining_balance)} available)
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-amber-700">The advance's remaining balance will be reduced by this amount when saved.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Vendor</label>
                <select value={formData.vendor_id} onChange={(e) => handleVendorChange(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Name</label>
                  <input type="text" value={formData.vendor_name_text} onChange={(e) => setFormData({ ...formData, vendor_name_text: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">TRN</label>
                  <input type="text" value={formData.trn_text} onChange={(e) => setFormData({ ...formData, trn_text: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                </div>
              </div>
              <div className="flex items-center gap-3 py-1">
                <input type="checkbox" id="site_tax" checked={formData.tax_included} onChange={(e) => setFormData({ ...formData, tax_included: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                <label htmlFor="site_tax" className="text-sm font-medium text-slate-700">Tax Included</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              {currentOrganization && (
                <div className="pt-2 border-t border-slate-200">
                  <AttachmentsManager organizationId={currentOrganization.id} entityType="site_expense" entityId={editing?.id || null} />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition">{submitting ? 'Saving...' : editing ? 'Update' : 'Submit Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
