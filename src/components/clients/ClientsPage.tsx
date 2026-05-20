import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, X, Mail, Phone, MapPin, User } from 'lucide-react';

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
}

export default function ClientsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

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

      setClients((clientsData || []).map(c => ({ ...c, project_count: countMap[c.id] || 0 })));
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
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-600">No clients found.</td></tr>
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
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(client)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(client)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
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
    </div>
  );
}
