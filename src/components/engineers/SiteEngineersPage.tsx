import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, X, HardHat, Phone, Mail, Send, History, ChevronDown, ChevronUp, KeyRound, Loader2, Pencil, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

interface SiteEngineer {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  user_id: string | null;
  project_id: string | null;
  is_active: boolean;
  created_at: string;
  project?: { project_code: string; project_name: string } | null;
}

const EMPLOYEE_TITLES = ['Accountant', 'Site Engineer', 'Senior Execution Engineer', 'Procurement Employee', 'Other'] as const;

interface EngineerAdvance {
  id: string;
  engineer_id: string;
  amount: number;
  payment_source: string;
  notes: string;
  created_at: string;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

export default function SiteEngineersPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [engineers, setEngineers] = useState<SiteEngineer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEngineer, setSelectedEngineer] = useState<SiteEngineer | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advanceHistory, setAdvanceHistory] = useState<EngineerAdvance[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', project_id: '', title: '' });
  const [editFormData, setEditFormData] = useState({ name: '', email: '', phone: '', project_id: '', title: '', is_active: true });
  const [advanceForm, setAdvanceForm] = useState({ amount: 0, payment_source: 'cash', notes: '' });
  const [loginForm, setLoginForm] = useState({ password: '' });
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchEngineers();
      fetchProjects();
    }
  }, [currentOrganization]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchEngineers = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('site_engineers')
        .select('*, project:projects(project_code, project_name)')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEngineers(data || []);
      await computeBalances(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeBalances = async (engineerList: SiteEngineer[]) => {
    if (!currentOrganization || engineerList.length === 0) return;
    const ids = engineerList.map(e => e.id);

    const { data: advances } = await supabase
      .from('engineer_advances')
      .select('engineer_id, amount')
      .in('engineer_id', ids);

    const { data: expenses } = await supabase
      .from('engineer_expenses')
      .select('engineer_id, amount')
      .in('engineer_id', ids)
      .eq('status', 'Approved');

    const bals: Record<string, number> = {};
    ids.forEach(id => { bals[id] = 0; });
    (advances || []).forEach(a => { bals[a.engineer_id] = (bals[a.engineer_id] || 0) + Number(a.amount); });
    (expenses || []).forEach(e => { bals[e.engineer_id] = (bals[e.engineer_id] || 0) - Number(e.amount); });
    setBalances(bals);
  };

  const fetchProjects = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('projects').select('id, project_code, project_name')
      .eq('organization_id', currentOrganization.id).eq('project_status', 'active').order('project_code');
    setProjects(data || []);
  };

  const fetchAdvanceHistory = async (engineerId: string) => {
    const { data } = await supabase
      .from('engineer_advances')
      .select('*')
      .eq('engineer_id', engineerId)
      .order('created_at', { ascending: false });
    setAdvanceHistory(data || []);
  };

  const handleSubmitEngineer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('site_engineers').insert([{
        organization_id: currentOrganization.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        title: formData.title,
        project_id: formData.project_id || null,
        created_by: user.id,
      }]);
      if (error) throw error;

      await fetchEngineers();
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '', project_id: '', title: '' });
      setToast({ kind: 'success', message: `Employee "${formData.name}" added successfully.` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create employee.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEngineer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEngineer) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('site_engineers')
        .update({
          name: editFormData.name,
          email: editFormData.email,
          phone: editFormData.phone,
          title: editFormData.title,
          project_id: editFormData.project_id || null,
          is_active: editFormData.is_active,
        })
        .eq('id', selectedEngineer.id);
      if (error) throw error;
      await fetchEngineers();
      setShowEditModal(false);
      setSelectedEngineer(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update engineer.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEngineer = async () => {
    if (!selectedEngineer) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('site_engineers')
        .delete()
        .eq('id', selectedEngineer.id);
      if (error) throw error;
      await fetchEngineers();
      setShowDeleteConfirm(false);
      setSelectedEngineer(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete engineer.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user || !selectedEngineer) return;
    if (advanceForm.amount <= 0) {
      setFeedback({ kind: 'error', message: 'Amount must be greater than 0.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('engineer_advances').insert([{
        organization_id: currentOrganization.id,
        engineer_id: selectedEngineer.id,
        amount: advanceForm.amount,
        payment_source: advanceForm.payment_source,
        notes: advanceForm.notes,
        created_by: user.id,
      }]);
      if (error) throw error;
      await fetchEngineers();
      setShowAdvanceModal(false);
      setAdvanceForm({ amount: 0, payment_source: 'cash', notes: '' });
      setSelectedEngineer(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to send advance.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !selectedEngineer) return;
    if (loginForm.password.length < 6) {
      setFeedback({ kind: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-engineer-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: selectedEngineer.email,
          password: loginForm.password,
          engineer_id: selectedEngineer.id,
          organization_id: currentOrganization.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create login');
      await fetchEngineers();
      setShowLoginModal(false);
      setLoginForm({ password: '' });
      setSelectedEngineer(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create login.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (engineer: SiteEngineer) => {
    setSelectedEngineer(engineer);
    setEditFormData({
      name: engineer.name,
      email: engineer.email,
      phone: engineer.phone || '',
      title: engineer.title || '',
      project_id: engineer.project_id || '',
      is_active: engineer.is_active,
    });
    setFeedback(null);
    setShowEditModal(true);
  };

  const openDeleteConfirm = (engineer: SiteEngineer) => {
    setSelectedEngineer(engineer);
    setFeedback(null);
    setShowDeleteConfirm(true);
  };

  const handleExpand = async (engineer: SiteEngineer) => {
    if (expandedId === engineer.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(engineer.id);
    await fetchAdvanceHistory(engineer.id);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  const filtered = engineers.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage Employees</h1>
          <p className="text-slate-600">Manage employees and their advance balances</p>
        </div>
        <button onClick={() => { setShowModal(true); setFeedback(null); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
          <Plus className="w-5 h-5" />Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search engineers..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-600">No site engineers found. Add your first engineer to get started.</div>
          ) : filtered.map(engineer => (
            <div key={engineer.id}>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${engineer.is_active ? 'bg-amber-100' : 'bg-slate-200'}`}>
                    <HardHat className={`w-5 h-5 ${engineer.is_active ? 'text-amber-700' : 'text-slate-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      {engineer.name}
                      {!engineer.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-medium">Inactive</span>}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      {engineer.title && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">{engineer.title}</span>}
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{engineer.email}</span>
                      {engineer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{engineer.phone}</span>}
                    </div>
                    {engineer.project && (
                      <div className="text-xs text-slate-500 mt-0.5">{engineer.project.project_code} - {engineer.project.project_name}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Balance</div>
                    <div className={`text-lg font-bold ${(balances[engineer.id] || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(balances[engineer.id] || 0)}
                    </div>
                  </div>
                  {!engineer.user_id && (
                    <button
                      onClick={() => { setSelectedEngineer(engineer); setShowLoginModal(true); setFeedback(null); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition"
                      title="Create Login Account"
                    >
                      <KeyRound className="w-3.5 h-3.5" />Login
                    </button>
                  )}
                  {engineer.user_id && (
                    <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Login Active</span>
                  )}
                  <button
                    onClick={() => openEditModal(engineer)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit Engineer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(engineer)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete Engineer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleExpand(engineer)} className="p-2 hover:bg-slate-100 rounded-lg transition">
                    {expandedId === engineer.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === engineer.id && (
                <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                  <div className="pt-3">
                    <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
                      <History className="w-3.5 h-3.5" /> Advance History
                    </h4>
                    {advanceHistory.length === 0 ? (
                      <p className="text-xs text-slate-500">No advances sent yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {advanceHistory.map(adv => (
                          <div key={adv.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                            <div>
                              <span className="text-sm font-medium text-slate-900">{formatCurrency(adv.amount)}</span>
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">{adv.payment_source}</span>
                              {adv.notes && <span className="ml-2 text-xs text-slate-500">{adv.notes}</span>}
                            </div>
                            <span className="text-xs text-slate-500">{new Date(adv.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-xl font-bold text-slate-900">Add Employee</h2>
              <button onClick={() => { setShowModal(false); setFeedback(null); }} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitEngineer} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{feedback.message}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <select value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select title...</option>
                  {EMPLOYEE_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Project</label>
                <select value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setFeedback(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition">{submitting ? 'Saving...' : 'Add Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEngineer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Edit Employee</h2>
              <button onClick={() => { setShowEditModal(false); setFeedback(null); setSelectedEngineer(null); }} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditEngineer} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{feedback.message}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <select value={editFormData.title} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select title...</option>
                  {EMPLOYEE_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input type="text" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Project</label>
                <select value={editFormData.project_id} onChange={(e) => setEditFormData({ ...editFormData, project_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-checked:bg-blue-600 rounded-full peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
                <span className="text-sm text-slate-700">Active</span>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setFeedback(null); setSelectedEngineer(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedEngineer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Delete Engineer</h2>
              </div>
              {feedback && (
                <div className={`mb-4 px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{feedback.message}</div>
              )}
              <p className="text-slate-600 mb-2">
                Are you sure you want to permanently delete <span className="font-semibold text-slate-900">{selectedEngineer.name}</span>?
              </p>
              <p className="text-sm text-slate-500 mb-6">
                This will also remove all associated advance records and expenses. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setFeedback(null); setSelectedEngineer(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button onClick={handleDeleteEngineer} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg transition">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {submitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Advance Modal */}
      {showAdvanceModal && selectedEngineer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Send Advance</h2>
                <p className="text-sm text-slate-600 mt-0.5">To: {selectedEngineer.name}</p>
              </div>
              <button onClick={() => { setShowAdvanceModal(false); setFeedback(null); setSelectedEngineer(null); }} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSendAdvance} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{feedback.message}</div>
              )}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs text-slate-500">Current Balance</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(balances[selectedEngineer.id] || 0)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <input type="number" step="0.01" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Source *</label>
                <select value={advanceForm.payment_source} onChange={(e) => setAdvanceForm({ ...advanceForm, payment_source: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={advanceForm.notes} onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAdvanceModal(false); setFeedback(null); setSelectedEngineer(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition">{submitting ? 'Sending...' : 'Send Advance'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Login Modal */}
      {showLoginModal && selectedEngineer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create Login Account</h2>
                <p className="text-sm text-slate-600 mt-0.5">For: {selectedEngineer.name} ({selectedEngineer.email})</p>
              </div>
              <button onClick={() => { setShowLoginModal(false); setFeedback(null); setSelectedEngineer(null); }} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateLogin} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{feedback.message}</div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                This will create a login account for the engineer using their email address. They will be able to sign in and submit expenses from their own dashboard.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="text" value={selectedEngineer.email} disabled className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ password: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Minimum 6 characters" required minLength={6} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowLoginModal(false); setFeedback(null); setSelectedEngineer(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-lg transition">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {submitting ? 'Creating...' : 'Create Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg border transition-all animate-[fadeIn_0.2s_ease-out] ${toast.kind === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex items-center gap-2">
            {toast.kind === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
