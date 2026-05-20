import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, Package, DollarSign, Eye, Paperclip } from 'lucide-react';
import AttachmentsManager from '../attachments/AttachmentsManager';

interface Item {
  id: string;
  item_type: 'product' | 'service';
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  sales_price: number;
  purchase_price: number;
  track_inventory: boolean;
  quantity_on_hand: number;
  is_active: boolean;
}

export default function ItemsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'product' | 'service'>('all');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultForm = {
    item_type: 'service' as 'product' | 'service',
    sku: '',
    name: '',
    description: '',
    unit: 'unit',
    sales_price: 0,
    purchase_price: 0,
    track_inventory: false,
    quantity_on_hand: 0,
    reorder_level: 0,
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (currentOrganization) fetchItems();
  }, [currentOrganization]);

  const fetchItems = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const active = (data || []).filter((i: Item) => i.is_active);
      setItems(active);

      const ids = active.map((i: Item) => i.id);
      if (ids.length) {
        const { data: atts } = await supabase
          .from('attachments').select('entity_id')
          .eq('entity_type', 'item').in('entity_id', ids);
        const counts: Record<string, number> = {};
        (atts || []).forEach((a: { entity_id: string }) => {
          counts[a.entity_id] = (counts[a.entity_id] || 0) + 1;
        });
        setAttachmentCounts(counts);
      } else {
        setAttachmentCounts({});
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      if (editingItem) {
        const { error } = await supabase.from('items').update(formData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('items')
          .insert([{ ...formData, organization_id: currentOrganization.id }]);
        if (error) throw error;
      }
      await fetchItems();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving item:', error);
      const message = error instanceof Error ? error.message : 'Failed to save item.';
      setFeedback({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      item_type: item.item_type,
      sku: item.sku || '',
      name: item.name,
      description: item.description || '',
      unit: item.unit,
      sales_price: item.sales_price,
      purchase_price: item.purchase_price,
      track_inventory: item.track_inventory,
      quantity_on_hand: item.quantity_on_hand,
      reorder_level: 0,
    });
    setShowModal(true);
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
    try {
      const { error } = await supabase.from('items').update({ is_active: false }).eq('id', item.id);
      if (error) throw error;
      await fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(defaultForm);
    setFeedback(null);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(q) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q));
    const matchesType = filterType === 'all' || item.item_type === filterType;
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Products & Services</h1>
          <p className="text-slate-600">Manage your product and service catalog</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items by name, SKU, or description..."
                className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'product', 'service'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-4 py-2 rounded-lg transition capitalize ${
                    filterType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t === 'all' ? 'All' : `${t}s`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Name/SKU</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Sales Price</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Purchase Price</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-600 uppercase">Stock</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-600">
                    No items found. Add your first product or service to get started.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.item_type === 'product' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {item.item_type === 'product' ? 'Product' : 'Service'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{item.name}</div>
                          {item.sku && <div className="text-xs text-slate-600">SKU: {item.sku}</div>}
                        </div>
                        {attachmentCounts[item.id] > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${attachmentCounts[item.id]} attachment(s)`}>
                            <Paperclip className="w-3 h-3" />{attachmentCounts[item.id]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{item.description || '-'}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(item.sales_price)}</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-600">{formatCurrency(item.purchase_price)}</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-900">
                      {item.track_inventory ? item.quantity_on_hand : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setViewingItem(item)}
                        className="text-slate-600 hover:text-slate-900 p-2 hover:bg-slate-100 rounded transition mr-1"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-1"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"
                        title="Delete"
                      >
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
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {feedback.message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['service', 'product'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, item_type: t })}
                      className={`p-4 border-2 rounded-lg transition ${
                        formData.item_type === t ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <Package className="w-5 h-5" />
                        <span className="font-medium capitalize">{t}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">SKU/Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <DollarSign className="w-4 h-4 inline" />Sales Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sales_price}
                    onChange={(e) => setFormData({ ...formData, sales_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.item_type === 'product' && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="track_inventory"
                      checked={formData.track_inventory}
                      onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="track_inventory" className="text-sm font-medium text-slate-700">
                      Track inventory for this product
                    </label>
                  </div>

                  {formData.track_inventory && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Quantity on Hand</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.quantity_on_hand}
                          onChange={(e) => setFormData({ ...formData, quantity_on_hand: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Reorder Level</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.reorder_level}
                          onChange={(e) => setFormData({ ...formData, reorder_level: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentOrganization && (
                <div className="pt-2 border-t border-slate-200">
                  <AttachmentsManager
                    organizationId={currentOrganization.id}
                    entityType="item"
                    entityId={editingItem?.id || null}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition"
                >
                  {submitting ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingItem && currentOrganization && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{viewingItem.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    viewingItem.item_type === 'product' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {viewingItem.item_type === 'product' ? 'Product' : 'Service'}
                  </span>
                  {viewingItem.sku && <span className="text-xs text-slate-500">SKU: {viewingItem.sku}</span>}
                </div>
              </div>
              <button onClick={() => setViewingItem(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Sales Price</div>
                  <div className="text-lg font-semibold text-slate-900">{formatCurrency(viewingItem.sales_price)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Purchase Price</div>
                  <div className="text-lg font-semibold text-slate-900">{formatCurrency(viewingItem.purchase_price)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Unit</div>
                  <div className="text-sm text-slate-900">{viewingItem.unit}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Stock</div>
                  <div className="text-sm text-slate-900">
                    {viewingItem.track_inventory ? viewingItem.quantity_on_hand : 'Not tracked'}
                  </div>
                </div>
              </div>

              {viewingItem.description && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Description</div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewingItem.description}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <AttachmentsManager
                  organizationId={currentOrganization.id}
                  entityType="item"
                  entityId={viewingItem.id}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setViewingItem(null); handleEdit(viewingItem); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  <Edit className="w-4 h-4" />Edit Item
                </button>
                <button
                  onClick={() => setViewingItem(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
