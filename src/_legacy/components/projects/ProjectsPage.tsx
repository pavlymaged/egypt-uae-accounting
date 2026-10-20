import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Plus, Search, Edit, Trash2, X, FolderKanban, Eye,
  Calendar, Hash, Percent, Building2,
} from 'lucide-react';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_id: string;
  project_type: string;
  project_status: string;
  management_fee_percent: number;
  management_fee_on_income_percent: number;
  project_address: string | null;
  notes: string | null;
  created_at: string;
  client?: { name: string; phone: string | null; contact_person: string | null };
}

interface Client {
  id: string;
  name: string;
  phone: string | null;
  contact_person: string | null;
}

const PROJECT_TYPES = [
  { value: 'design', label: 'Design' },
  { value: 'fit_out', label: 'Fit Out' },
  { value: 'consultancy', label: 'Consultancy' },
];

const typeColors: Record<string, string> = {
  design: 'bg-sky-100 text-sky-800',
  fit_out: 'bg-amber-100 text-amber-800',
  consultancy: 'bg-teal-100 text-teal-800',
};

export default function ProjectsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  const [formData, setFormData] = useState({
    project_name: '',
    client_id: '',
    project_type: 'design',
    management_fee_percent: 0,
    project_address: '',
    notes: '',
  });

  useEffect(() => {
    if (currentOrganization) {
      fetchProjects();
      fetchClients();
    }
  }, [currentOrganization]);

  const fetchProjects = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:customers(name, phone, contact_person)')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, contact_person')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const generateProjectCode = async () => {
    if (!currentOrganization) return 'PRJ-0001';
    const { data } = await supabase
      .from('projects')
      .select('project_code')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) return 'PRJ-0001';
    const match = data[0].project_code.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `PRJ-${String(next).padStart(4, '0')}`;
  };

  const calcMfOnIncome = (mfPercent: number) => {
    if (mfPercent <= 0) return 0;
    return (mfPercent / (100 + mfPercent)) * 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    try {
      const mfOnIncome = calcMfOnIncome(formData.management_fee_percent);
      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update({
            project_name: formData.project_name,
            client_id: formData.client_id,
            project_type: formData.project_type,
            management_fee_percent: formData.management_fee_percent,
            management_fee_on_income_percent: mfOnIncome,
            project_address: formData.project_address,
            notes: formData.notes,
          })
          .eq('id', editingProject.id);
        if (error) throw error;
      } else {
        const code = await generateProjectCode();
        const { error } = await supabase.from('projects').insert([{
          project_code: code,
          project_name: formData.project_name,
          client_id: formData.client_id,
          project_type: formData.project_type,
          management_fee_percent: formData.management_fee_percent,
          management_fee_on_income_percent: mfOnIncome,
          project_address: formData.project_address,
          notes: formData.notes,
          organization_id: currentOrganization.id,
          created_by: user.id,
        }]);
        if (error) throw error;
      }
      await fetchProjects();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project');
    }
  };

  const handleToggleStatus = async (project: Project) => {
    const newStatus = project.project_status === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('projects')
        .update({ project_status: newStatus })
        .eq('id', project.id);
      if (error) throw error;
      await fetchProjects();
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      project_name: project.project_name,
      client_id: project.client_id,
      project_type: project.project_type,
      management_fee_percent: project.management_fee_percent,
      project_address: project.project_address || '',
      notes: project.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setFormData({
      project_name: '',
      client_id: '',
      project_type: 'design',
      management_fee_percent: 0,
      project_address: '',
      notes: '',
    });
  };

  const filteredProjects = projects.filter(p =>
    p.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.client?.name && p.client.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeCount = projects.filter(p => p.project_status === 'active').length;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentOrganization?.base_currency || 'USD',
    }).format(amount);

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Projects</h1>
          <p className="text-slate-600">Create and manage your projects</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Projects</span>
            <FolderKanban className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{projects.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Active Projects</span>
            <FolderKanban className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Clients</span>
            <Building2 className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{clients.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project code, name, or client..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Code</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Client</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">MF %</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">MF on Income %</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-600">
                    No projects found. Create your first project to get started.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setViewingProject(project); setShowDetailModal(true); }}>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{project.project_code}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{project.project_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{project.client?.name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[project.project_type] || 'bg-slate-100 text-slate-800'}`}>
                        {PROJECT_TYPES.find(t => t.value === project.project_type)?.label || project.project_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{project.management_fee_percent}%</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{project.management_fee_on_income_percent.toFixed(4)}%</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.project_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {project.project_status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setViewingProject(project); setShowDetailModal(true); }} className="text-slate-600 hover:text-slate-700 p-2 hover:bg-slate-100 rounded transition mr-1">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(project)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-1">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleStatus(project)} className="text-amber-600 hover:text-amber-700 p-2 hover:bg-amber-50 rounded transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
              <h2 className="text-2xl font-bold text-slate-900">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Client *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Type *</label>
                  <select
                    value={formData.project_type}
                    onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Percent className="w-4 h-4 inline mr-1" />
                    Management Fee % *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.management_fee_percent}
                    onChange={(e) => setFormData({ ...formData, management_fee_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Hash className="w-4 h-4" />
                  <span className="font-medium">Management Fee on Income:</span>
                  <span>{calcMfOnIncome(formData.management_fee_percent).toFixed(4)}%</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">Auto-calculated as MF% / (100 + MF%) x 100</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Project Address</label>
                <textarea
                  value={formData.project_address}
                  onChange={(e) => setFormData({ ...formData, project_address: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && viewingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">Project Details</h2>
              <button onClick={() => { setShowDetailModal(false); setViewingProject(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Project Code</span>
                  <p className="text-lg font-bold text-blue-600">{viewingProject.project_code}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Status</span>
                  <p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      viewingProject.project_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {viewingProject.project_status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Project Name</span>
                <p className="text-slate-900 font-medium">{viewingProject.project_name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Client</span>
                <p className="text-slate-900">{viewingProject.client?.name || '-'}</p>
                {viewingProject.client?.contact_person && <p className="text-sm text-slate-600">Contact: {viewingProject.client.contact_person}</p>}
                {viewingProject.client?.phone && <p className="text-sm text-slate-600">Phone: {viewingProject.client.phone}</p>}
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Type</span>
                <p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[viewingProject.project_type] || 'bg-slate-100 text-slate-800'}`}>
                    {PROJECT_TYPES.find(t => t.value === viewingProject.project_type)?.label}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Management Fee</span>
                  <p className="text-slate-900 font-medium">{viewingProject.management_fee_percent}%</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">MF on Income</span>
                  <p className="text-slate-900 font-medium">{viewingProject.management_fee_on_income_percent.toFixed(4)}%</p>
                </div>
              </div>
              {viewingProject.project_address && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Project Address</span>
                  <p className="text-slate-600">{viewingProject.project_address}</p>
                </div>
              )}
              {viewingProject.notes && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Notes</span>
                  <p className="text-slate-600">{viewingProject.notes}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleToggleStatus(viewingProject)}
                  className={`flex-1 px-4 py-2 rounded-lg transition ${
                    viewingProject.project_status === 'active'
                      ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                      : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                  }`}
                >
                  {viewingProject.project_status === 'active' ? 'Set Inactive' : 'Set Active'}
                </button>
                <button
                  onClick={() => { setShowDetailModal(false); handleEdit(viewingProject); }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Edit Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
