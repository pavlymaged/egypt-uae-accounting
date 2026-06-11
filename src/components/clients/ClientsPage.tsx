import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, Mail, Phone, MapPin, User, KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface Client {
  id: string;
  customer_number: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  is_active: boolean;
  project_count?: number;
  portal_user?: { email: string; is_active: boolean } | null;
}

export default function ClientsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showCredModal, setShowCredModal] = useState(false);
  const [credClient, setCredClient] = useState<Client | null>(null);
  const [credEmail, setCredEmail] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credShowPassword, setCredShowPassword] = useState(false);
  const [credSubmitting, setCredSubmitting] = useState(false);
  const [credSuccess, setCredSuccess] = useState('');
  const [credError, setCredError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    billing_address: '',
  });

  useEffect(() => {
    if (currentOrganization) fetchClients();
  }, [currentOrganization]);

  const fetchClients = async () => {
    if (!currentOrganization) return;
    try {
      const { data: clientsData, error } = await supabase
        .from('customers')
        .select('id, customer_number, name, contact_person, email, phone, billing_address, is_active')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: projectCounts } = await supabase
        .from('projects')
        .select('client_id')
        .eq('organization_id', currentOrganization.id);

      const countMap: Record<string, number> = {};
      projectCounts?.forEach(p => {
        countMap[p.client_id] = (countMap[p.client_id] || 0) + 1;
      });

      const { data: portalUsers } = await supabase
        .from('client_portal_users')
        .select('customer_id, email, is_active')
        .eq('organization_id', currentOrganization.id);

      const portalMap: Record<string, { email: string; is_active: boolean }> = {};
      portalUsers?.forEach(pu => {
        portalMap[pu.customer_id] = { email: pu.email, is_active: pu.is_active };
      });

      setClients((clientsData || []).map(c => ({
        ...c,
        project_count: countMap[c.id] || 0,
        portal_user: portalMap[c.id] || null,
      })));
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'CLT-0001';
    const { data } = await supabase
      .from('customers')
      .select('customer_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) return 'CLT-0001';
    const match = data[0].customer_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `CLT-${String(next).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    try {
      if (editingClient) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            contact_person: formData.contact_person,
            email: formData.email,
            phone: formData.phone,
            billing_address: formData.billing_address,
          })
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const num = await generateNumber();
        const { error } = await supabase.from('customers').insert([{
          customer_number: num,
          name: formData.name,
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          billing_address: formData.billing_address,
          organization_id: currentOrganization.id,
          currency: currentOrganization.base_currency,
        }]);
        if (error) throw error;
      }
      await fetchClients();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client');
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      billing_address: client.billing_address || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Are you sure you want to deactivate ${client.name}?`)) return;
    try {
      const { error } = await supabase.from('customers').update({ is_active: false }).eq('id', client.id);
      if (error) throw error;
      await fetchClients();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({ name: '', contact_person: '', email: '', phone: '', billing_address: '' });
  };

  const openCredModal = (client: Client) => {
    setCredClient(client);
    setCredEmail(client.portal_user?.email || client.email || '');
    setCredPassword('');
    setCredSuccess('');
    setCredError('');
    setCredShowPassword(false);
    setShowCredModal(true);
  };

  const handleCredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user || !credClient) return;
    if (!credEmail || !credPassword) {
      setCredError('Email and password are required');
      return;
    }
    if (credPassword.length < 6) {
      setCredError('Password must be at least 6 characters');
      return;
    }

    setCredSubmitting(true);
    setCredError('');
    setCredSuccess('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('create-client-user', {
        body: {
          email: credEmail,
          password: credPassword,
          customerId: credClient.id,
          organizationId: currentOrganization.id,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to assign credentials');
      }

      const result = response.data;
      if (result.error) throw new Error(result.error);

      setCredSuccess(`Credentials ${credClient.portal_user ? 'updated' : 'created'} successfully! Share with client:\n\nEmail: ${credEmail}\nPassword: ${credPassword}`);
      await fetchClients();
    } catch (error: any) {
      setCredError(error.message || 'Failed to assign credentials');
    } finally {
      setCredSubmitting(false);
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contact_person && c.contact_person.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Clients</h1>
          <p className="text-slate-600">Manage your client database</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name, number, or contact..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Contact Person</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Phone / Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Projects</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Portal</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-600">No clients found.</td></tr>
              ) : (
                filtered.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{client.customer_number}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{client.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {client.contact_person ? (
                        <div className="flex items-center gap-1"><User className="w-3 h-3" />{client.contact_person}</div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {client.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</div>}
                      {client.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{client.project_count || 0}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {client.portal_user ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <ShieldCheck className="w-3 h-3" />
                          Has Login
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No login</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openCredModal(client)} className="text-amber-600 hover:text-amber-700 p-2 hover:bg-amber-50 rounded transition mr-1" title="Set Login Credentials">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(client)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-1"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(client)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Client Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2"><User className="w-4 h-4 inline mr-1" />Contact Person *</label>
                <input type="text" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2"><Phone className="w-4 h-4 inline mr-1" />Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2"><Mail className="w-4 h-4 inline mr-1" />Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2"><MapPin className="w-4 h-4 inline mr-1" />Client Address</label>
                <textarea value={formData.billing_address} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">{editingClient ? 'Update Client' : 'Add Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credential Assignment Modal */}
      {showCredModal && credClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {credClient.portal_user ? 'Update Login Credentials' : 'Assign Login Credentials'}
                </h2>
                <p className="text-sm text-slate-600 mt-1">{credClient.name}</p>
              </div>
              <button onClick={() => setShowCredModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCredSubmit} className="p-6 space-y-4">
              {credClient.portal_user && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>This client already has login access ({credClient.portal_user.email}). Updating will change their credentials.</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Login Email *</label>
                <input
                  type="email"
                  value={credEmail}
                  onChange={(e) => setCredEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={credShowPassword ? 'text' : 'password'}
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min 6 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setCredShowPassword(!credShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {credShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {credError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{credError}</div>
              )}

              {credSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Credentials Saved
                  </div>
                  <pre className="text-sm text-green-700 whitespace-pre-wrap font-mono bg-green-100 rounded p-2">{credSuccess.split('\n\n')[1]}</pre>
                  <p className="text-xs text-green-600 mt-2">Share these credentials with the client. They can login at /client-portal</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCredModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">
                  {credSuccess ? 'Close' : 'Cancel'}
                </button>
                {!credSuccess && (
                  <button type="submit" disabled={credSubmitting} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    {credSubmitting ? 'Saving...' : credClient.portal_user ? 'Update Credentials' : 'Create Credentials'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
