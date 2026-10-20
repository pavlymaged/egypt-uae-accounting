import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, AlertCircle, Download, Paperclip } from 'lucide-react';
import AttachmentsManager from '../attachments/AttachmentsManager';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

interface Vendor {
  id: string;
  vendor_number: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  billing_address: string | null;
  tax_registration_number: string | null;
  default_tax_rate_id: string | null;
  current_balance: number;
  is_active: boolean;
}

const TRN_REGEX = /^[A-Z0-9\-]{3,20}$/i;

function validateTrn(value: string): string {
  if (!value.trim()) return 'Tax Registration Number is required.';
  if (!TRN_REGEX.test(value.trim())) return 'TRN must be 3–20 alphanumeric characters (hyphens allowed).';
  return '';
}

export default function VendorsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [trnError, setTrnError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const defaultForm = {
    name: '',
    email: '',
    phone: '',
    contact_person: '',
    billing_address: '',
    tax_registration_number: '',
    default_tax_rate_id: '',
    vat_number: '',
    payment_terms: 30,
    notes: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (currentOrganization) {
      fetchVendors();
      fetchTaxRates();
    }
  }, [currentOrganization]);

  const fetchVendors = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
      const ids = (data || []).map(d => d.id);
      if (ids.length) {
        const { data: atts } = await supabase
          .from('attachments').select('entity_id')
          .eq('entity_type', 'vendor').in('entity_id', ids);
        const counts: Record<string, number> = {};
        (atts || []).forEach((a: { entity_id: string }) => { counts[a.entity_id] = (counts[a.entity_id] || 0) + 1; });
        setAttachmentCounts(counts);
      } else setAttachmentCounts({});
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxRates = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('tax_rates').select('id, name, rate').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
    setTaxRates(data || []);
  };

  const generateVendorNumber = async () => {
    if (!currentOrganization) return 'VEND-0001';

    const { data } = await supabase
      .from('vendors')
      .select('vendor_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'VEND-0001';

    const lastNumber = data[0].vendor_number;
    const match = lastNumber.match(/\d+$/);
    const nextNumber = match ? parseInt(match[0]) + 1 : 1;
    return `VEND-${String(nextNumber).padStart(4, '0')}`;
  };

  const handleTrnChange = (value: string) => {
    const cleaned = value.replace(/^0+/, '') || '0';
    setFormData({ ...formData, tax_registration_number: cleaned });
    if (submitAttempted) {
      setTrnError(validateTrn(cleaned));
    }
  };

  const handleTrnBlur = () => {
    setTrnError(validateTrn(formData.tax_registration_number));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;

    setSubmitAttempted(true);
    const trnValidationError = validateTrn(formData.tax_registration_number);
    if (trnValidationError) {
      setTrnError(trnValidationError);
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        contact_person: formData.contact_person || null,
        billing_address: formData.billing_address || null,
        tax_registration_number: formData.tax_registration_number.trim().toUpperCase(),
        default_tax_rate_id: formData.default_tax_rate_id || null,
        vat_number: formData.vat_number || null,
        payment_terms: formData.payment_terms,
        notes: formData.notes || null,
      };

      if (editingVendor) {
        const { error } = await supabase.from('vendors').update(payload).eq('id', editingVendor.id);
        if (error) throw error;
      } else {
        const vendorNumber = await generateVendorNumber();
        const { data: inserted, error } = await supabase.from('vendors').insert([{
          ...payload,
          vendor_number: vendorNumber,
          organization_id: currentOrganization.id,
          currency: currentOrganization.base_currency,
        }]).select('*').single();
        if (error) throw error;
        await fetchVendors();
        if (inserted) { setEditingVendor(inserted as Vendor); return; }
      }

      await fetchVendors();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving vendor:', error);
      alert('Failed to save vendor');
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      contact_person: vendor.contact_person || '',
      billing_address: vendor.billing_address || '',
      tax_registration_number: vendor.tax_registration_number || '',
      default_tax_rate_id: vendor.default_tax_rate_id || '',
      vat_number: '',
      payment_terms: 30,
      notes: '',
    });
    setTrnError('');
    setSubmitAttempted(false);
    setShowModal(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete ${vendor.name}?`)) return;

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', vendor.id);

      if (error) throw error;
      await fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      alert('Failed to delete vendor');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingVendor(null);
    setTrnError('');
    setSubmitAttempted(false);
    setFormData(defaultForm);
  };

  const getTaxRateName = (id: string | null) => {
    if (!id) return null;
    const rate = taxRates.find(r => r.id === id);
    return rate ? `${rate.name} (${rate.rate}%)` : null;
  };

  const exportToCSV = () => {
    const headers = ['Number', 'Name', 'Contact Person', 'TRN', 'Tax Rate', 'Email', 'Phone', 'Balance', 'Status'];
    const rows = vendors.map(v => [
      v.vendor_number, `"${v.name}"`, `"${v.contact_person || ''}"`,
      v.tax_registration_number || '', `"${getTaxRateName(v.default_tax_rate_id) || ''}"`,
      v.email || '', v.phone || '', v.current_balance.toFixed(2),
      v.is_active ? 'Active' : 'Inactive',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.vendor_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentOrganization?.base_currency || 'USD',
    }).format(amount);
  };

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Vendors</h1>
          <p className="text-slate-600">Manage your vendor database</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
            <Plus className="w-5 h-5" />Add Vendor
          </button>
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
              placeholder="Search vendors..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">TRN</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Tax Rate</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Contact Info</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Balance</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVendors.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-600">No vendors found.</td></tr>
              ) : filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {vendor.vendor_number}
                      {attachmentCounts[vendor.id] > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${attachmentCounts[vendor.id]} attachment(s)`}>
                          <Paperclip className="w-3 h-3" />{attachmentCounts[vendor.id]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{vendor.contact_person || <span className="text-slate-400">-</span>}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {vendor.tax_registration_number ? (
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-700">{vendor.tax_registration_number}</span>
                    ) : (
                      <span className="text-amber-600 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {getTaxRateName(vendor.default_tax_rate_id) || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {vendor.email && <div>{vendor.email}</div>}
                    {vendor.phone && <div>{vendor.phone}</div>}
                    {!vendor.email && !vendor.phone && <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-medium ${vendor.current_balance > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                      {formatCurrency(vendor.current_balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${vendor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(vendor)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded mr-2"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(vendor)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contact Person</label>
                <input type="text" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Primary contact name" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Registration Number (TRN) *</label>
                  <p className="text-xs text-slate-500 mb-2">3-20 alphanumeric characters. Hyphens allowed.</p>
                  <input type="text" value={formData.tax_registration_number} onChange={(e) => handleTrnChange(e.target.value)} onBlur={handleTrnBlur} placeholder="e.g. 100-234-567" className={`w-full px-4 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 font-mono ${trnError ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-slate-200 focus:ring-blue-500'}`} />
                  {trnError && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{trnError}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Default Tax Rate</label>
                  <p className="text-xs text-slate-500 mb-2">Auto-applied on quotations and expenses.</p>
                  <select value={formData.default_tax_rate_id} onChange={(e) => setFormData({ ...formData, default_tax_rate_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">No default tax rate</option>
                    {taxRates.map(r => <option key={r.id} value={r.id}>{r.name} ({r.rate}%)</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea value={formData.billing_address} onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>

              {currentOrganization && (
                <div className="pt-2 border-t border-slate-200">
                  <AttachmentsManager organizationId={currentOrganization.id} entityType="vendor" entityId={editingVendor?.id || null} />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
