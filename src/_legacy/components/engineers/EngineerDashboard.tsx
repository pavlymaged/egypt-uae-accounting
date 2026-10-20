import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Plus, Wallet, Clock, CheckCircle, XCircle, CreditCard as Edit, X, Upload, LogOut, Building2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface SiteEngineer {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  project_id: string | null;
}

interface EngineerExpense {
  id: string;
  expense_date: string;
  amount: number;
  tax: number;
  description: string;
  category: string;
  profession: string;
  project_id: string | null;
  payment_method: string;
  receipt_photo_url: string;
  status: string;
  accountant_notes: string;
  submitted_at: string;
  project?: { project_code: string; project_name: string } | null;
}

interface Project { id: string; project_code: string; project_name: string; }
interface ServiceType { id: string; name: string; }

const statusColors: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Amended: 'bg-blue-100 text-blue-800',
};

const statusIcons: Record<string, typeof Clock> = {
  Pending: Clock,
  Approved: CheckCircle,
  Rejected: XCircle,
  Amended: Edit,
};

export default function EngineerDashboard() {
  const { user, signOut } = useAuth();
  const { currentOrganization } = useOrganization();
  const [engineer, setEngineer] = useState<SiteEngineer | null>(null);
  const [balance, setBalance] = useState(0);
  const [expenses, setExpenses] = useState<EngineerExpense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [serviceTypesLoading, setServiceTypesLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [serviceTypesError, setServiceTypesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<EngineerExpense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const defaultForm = {
    expense_date: new Date().toISOString().split('T')[0],
    amount: 0,
    tax: 0,
    description: '',
    category: 'Material',
    profession: '',
    project_id: '',
    payment_method: 'employee_advance',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (user) fetchEngineerProfile();
  }, [user]);

  useEffect(() => {
    if (showForm && engineer) {
      fetchProjects(engineer.organization_id);
      fetchServiceTypes(engineer.organization_id);
    }
  }, [showForm]);

  const fetchEngineerProfile = async () => {
    if (!user) return;
    try {
      const { data: eng, error } = await supabase
        .from('site_engineers')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!eng) {
        setLoading(false);
        return;
      }
      setEngineer(eng);
      await Promise.all([
        fetchBalance(eng.id),
        fetchExpenses(eng.id),
        fetchProjects(eng.organization_id),
        fetchServiceTypes(eng.organization_id),
      ]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (engineerId: string) => {
    const { data: advances } = await supabase.from('engineer_advances').select('amount').eq('engineer_id', engineerId);
    const { data: approved } = await supabase.from('engineer_expenses').select('amount').eq('engineer_id', engineerId).eq('status', 'Approved');
    const totalAdvance = (advances || []).reduce((s, a) => s + Number(a.amount), 0);
    const totalSpent = (approved || []).reduce((s, e) => s + Number(e.amount), 0);
    setBalance(totalAdvance - totalSpent);
  };

  const fetchExpenses = async (engineerId: string) => {
    const { data } = await supabase
      .from('engineer_expenses')
      .select('*, project:projects(project_code, project_name)')
      .eq('engineer_id', engineerId)
      .order('submitted_at', { ascending: false });
    setExpenses(data || []);
  };

  const fetchProjects = async (orgId: string) => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const { data, error } = await supabase.from('projects').select('id, project_code, project_name').eq('organization_id', orgId).eq('project_status', 'active').order('project_code');
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchServiceTypes = async (orgId: string) => {
    setServiceTypesLoading(true);
    setServiceTypesError(null);
    try {
      const { data, error } = await supabase.from('service_types').select('id, name').eq('organization_id', orgId).eq('is_active', true).order('name');
      if (error) throw error;
      setServiceTypes(data || []);
    } catch (err) {
      setServiceTypesError(err instanceof Error ? err.message : 'Failed to load professions');
    } finally {
      setServiceTypesLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ kind: 'error', message: 'File too large. Maximum 10MB.' });
      return;
    }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const uploadReceipt = async (): Promise<string> => {
    if (!receiptFile || !engineer) return '';
    setUploading(true);
    const ext = receiptFile.name.split('.').pop();
    const path = `${engineer.organization_id}/${engineer.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('engineer-receipts').upload(path, receiptFile, { contentType: receiptFile.type });
    setUploading(false);
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engineer || !user) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      let photoUrl = editingExpense?.receipt_photo_url || '';
      if (receiptFile) {
        photoUrl = await uploadReceipt();
      }

      const payload = {
        expense_date: formData.expense_date,
        amount: formData.amount,
        tax: formData.tax,
        description: formData.description,
        category: formData.category,
        profession: formData.profession,
        project_id: formData.project_id || null,
        payment_method: 'employee_advance',
        receipt_photo_url: photoUrl,
      };

      if (editingExpense) {
        const { error } = await supabase.from('engineer_expenses')
          .update({ ...payload, status: 'Pending', accountant_notes: '' })
          .eq('id', editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('engineer_expenses').insert([{
          ...payload,
          organization_id: engineer.organization_id,
          engineer_id: engineer.id,
          status: 'Pending',
        }]);
        if (error) throw error;
      }

      await fetchExpenses(engineer.id);
      await fetchBalance(engineer.id);
      handleCloseForm();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to submit expense.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditExpense = (expense: EngineerExpense) => {
    if (expense.status !== 'Pending' && expense.status !== 'Amended') return;
    setEditingExpense(expense);
    setFormData({
      expense_date: expense.expense_date,
      amount: expense.amount,
      tax: expense.tax,
      description: expense.description,
      category: expense.category,
      profession: expense.profession,
      project_id: expense.project_id || '',
      payment_method: 'employee_advance',
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingExpense(null);
    setFormData(defaultForm);
    setReceiptFile(null);
    setReceiptPreview(null);
    setFeedback(null);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'EGP' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Engineer Profile</h2>
          <p className="text-slate-600 mb-4">Your account is not linked to a site engineer profile. Contact your accountant.</p>
          <button onClick={signOut} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{engineer.name}</div>
            <div className="text-xs text-slate-500">Site Engineer</div>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 hover:bg-slate-100 rounded-lg transition">
          <LogOut className="w-4 h-4" />Sign Out
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-100 text-sm mb-1 flex items-center gap-1"><Wallet className="w-4 h-4" /> Advance Balance</div>
              <div className="text-4xl font-bold">{formatCurrency(balance)}</div>
              <div className="text-blue-200 text-sm mt-1">Available to spend</div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white px-4 py-2.5 rounded-lg transition"
            >
              <Plus className="w-5 h-5" />Submit Expense
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['Pending', 'Approved', 'Rejected', 'Amended'].map(status => {
            const count = expenses.filter(e => e.status === status).length;
            const Icon = statusIcons[status];
            return (
              <div key={status} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">{status}</span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{count}</div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">My Expenses</h3>
          </div>
          <div className="divide-y divide-slate-200">
            {expenses.length === 0 ? (
              <div className="p-8 text-center text-slate-600">No expenses submitted yet.</div>
            ) : expenses.map(expense => (
              <div
                key={expense.id}
                className={`px-5 py-4 flex items-center justify-between ${(expense.status === 'Pending' || expense.status === 'Amended') ? 'hover:bg-blue-50/50 cursor-pointer' : ''}`}
                onClick={() => { if (expense.status === 'Pending' || expense.status === 'Amended') handleEditExpense(expense); }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{expense.description}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[expense.status]}`}>{expense.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                    <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                    <span className="capitalize">{expense.category}</span>
                    {expense.project && <span>{expense.project.project_code}</span>}
                  </div>
                  {expense.accountant_notes && (expense.status === 'Rejected' || expense.status === 'Amended') && (
                    <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs text-amber-800">
                      <span className="font-medium">Accountant: </span>{expense.accountant_notes}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="text-sm font-bold text-slate-900">{formatCurrency(expense.amount)}</div>
                  {expense.tax > 0 && <div className="text-xs text-slate-500">Tax: {formatCurrency(expense.tax)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-xl">
              <h2 className="text-xl font-bold text-slate-900">{editingExpense ? 'Edit Expense' : 'Submit New Expense'}</h2>
              <button onClick={handleCloseForm} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{feedback.message}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input type="date" value={formData.expense_date} onChange={e => setFormData({ ...formData, expense_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax</label>
                  <input type="number" step="0.01" value={formData.tax} onChange={e => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="Material">Material</option>
                    <option value="Labour">Labour</option>
                    <option value="Indirect">Indirect</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Profession</label>
                  {serviceTypesError ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-xs text-red-700 flex-1">{serviceTypesError}</span>
                      <button type="button" onClick={() => engineer && fetchServiceTypes(engineer.organization_id)} className="p-1 hover:bg-red-100 rounded"><RefreshCw className="w-3.5 h-3.5 text-red-600" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select value={formData.profession} onChange={e => setFormData({ ...formData, profession: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={serviceTypesLoading}>
                        {serviceTypesLoading ? (
                          <option value="">Loading...</option>
                        ) : serviceTypes.length === 0 ? (
                          <option value="">No professions available</option>
                        ) : (
                          <>
                            <option value="">Select profession</option>
                            {serviceTypes.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
                          </>
                        )}
                      </select>
                      {serviceTypesLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-9 top-1/2 -translate-y-1/2" />}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
                  {projectsError ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-xs text-red-700 flex-1">{projectsError}</span>
                      <button type="button" onClick={() => engineer && fetchProjects(engineer.organization_id)} className="p-1 hover:bg-red-100 rounded"><RefreshCw className="w-3.5 h-3.5 text-red-600" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <select value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required disabled={projectsLoading}>
                        {projectsLoading ? (
                          <option value="">Loading...</option>
                        ) : projects.length === 0 ? (
                          <option value="">No projects available</option>
                        ) : (
                          <>
                            <option value="">Select project</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                          </>
                        )}
                      </select>
                      {projectsLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-9 top-1/2 -translate-y-1/2" />}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700">Employee Advance</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Photo</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition">
                  {receiptPreview ? (
                    <div className="relative inline-block">
                      <img src={receiptPreview} alt="Preview" className="max-h-40 rounded-lg mx-auto" />
                      <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Click to upload receipt</p>
                      <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseForm} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting || uploading} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition flex items-center justify-center gap-2">
                  {(submitting || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Submitting...' : uploading ? 'Uploading...' : editingExpense ? 'Update & Resubmit' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
