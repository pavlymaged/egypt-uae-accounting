import { useState, useEffect } from 'react';
import { X, DollarSign, Plus, Edit2, Trash2, Save } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';

interface TaxRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
  organization_id: string;
}

export default function TaxRatesModal({ isOpen, onClose }: TaxRatesModalProps) {
  const { currentOrganization } = useOrganization();
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    rate: 0,
    is_default: false,
  });

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchTaxRates();
    }
  }, [isOpen, currentOrganization]);

  const fetchTaxRates = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('organization_id', currentOrganization?.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (fetchError) throw fetchError;
      setTaxRates(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tax rates');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', rate: 0, is_default: false });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('tax_rates')
          .update(formData)
          .eq('id', editingId);

        if (updateError) throw updateError;
        setSuccess('Tax rate updated successfully!');
      } else {
        const { error: insertError } = await supabase
          .from('tax_rates')
          .insert({
            ...formData,
            organization_id: currentOrganization?.id,
          });

        if (insertError) throw insertError;
        setSuccess('Tax rate added successfully!');
      }

      resetForm();
      await fetchTaxRates();
    } catch (err: any) {
      setError(err.message || 'Failed to save tax rate');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (taxRate: TaxRate) => {
    setFormData({
      name: taxRate.name,
      rate: taxRate.rate,
      is_default: taxRate.is_default,
    });
    setEditingId(taxRate.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tax rate?')) return;

    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('tax_rates')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSuccess('Tax rate deleted successfully!');
      await fetchTaxRates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete tax rate');
    }
  };

  const handleSetDefault = async (id: string) => {
    setError('');
    try {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('organization_id', currentOrganization?.id);

      const { error: updateError } = await supabase
        .from('tax_rates')
        .update({ is_default: true })
        .eq('id', id);

      if (updateError) throw updateError;
      setSuccess('Default tax rate updated!');
      await fetchTaxRates();
    } catch (err: any) {
      setError(err.message || 'Failed to set default tax rate');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-50" onClick={onClose} />

        <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Tax Rates</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Configure VAT and other tax rates for your organization
              </p>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Tax Rate
                </button>
              )}
            </div>

            {showAddForm && (
              <form onSubmit={handleSubmit} className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3">
                  {editingId ? 'Edit Tax Rate' : 'Add New Tax Rate'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Standard VAT"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Rate (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                      className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-slate-700">Set as default tax rate</span>
                  </label>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Saving...' : editingId ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loading && !showAddForm ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {taxRates.map((taxRate) => (
                  <div
                    key={taxRate.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{taxRate.name}</h3>
                        {taxRate.is_default && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        Rate: {taxRate.rate}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!taxRate.is_default && (
                        <button
                          onClick={() => handleSetDefault(taxRate.id)}
                          className="px-3 py-1 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(taxRate)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit tax rate"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(taxRate.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete tax rate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {taxRates.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No tax rates configured yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
