import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, X, Receipt, Calendar, DollarSign } from 'lucide-react';
import { BillLineItem, BillLineItemData } from './BillLineItem';

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  vendor?: {
    name: string;
    vendor_number: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  vendor_number: string;
}

interface Item {
  id: string;
  name: string;
  purchase_price: number;
}

interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

export default function BillsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    reference: '',
    notes: '',
  });

  const [lineItems, setLineItems] = useState<BillLineItemData[]>([{
    item_id: null,
    description: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_rate_id: null,
    tax_amount: 0,
    line_total: 0,
  }]);

  useEffect(() => {
    if (currentOrganization) {
      fetchBills();
      fetchVendors();
      fetchItems();
      fetchTaxRates();
    }
  }, [currentOrganization]);

  const fetchBills = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          vendor:vendors(name, vendor_number)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('bill_date', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, vendor_number')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchItems = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, purchase_price')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchTaxRates = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('id, name, rate')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTaxRates(data || []);
    } catch (error) {
      console.error('Error fetching tax rates:', error);
    }
  };

  const generateBillNumber = async () => {
    if (!currentOrganization) return 'BILL-0001';

    const { data } = await supabase
      .from('bills')
      .select('bill_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'BILL-0001';

    const lastNumber = data[0].bill_number;
    const match = lastNumber.match(/\d+$/);
    const nextNumber = match ? parseInt(match[0]) + 1 : 1;
    return `BILL-${String(nextNumber).padStart(4, '0')}`;
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, line) => {
      const lineSubtotal = line.quantity * line.unit_price;
      const discountAmount = lineSubtotal * (line.discount_percent / 100);
      return sum + (lineSubtotal - discountAmount);
    }, 0);

    const taxAmount = lineItems.reduce((sum, line) => sum + line.tax_amount, 0);
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user || !formData.vendor_id) {
      alert('Please select a vendor');
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    try {
      if (editingBill) {
        const { error: billError } = await supabase
          .from('bills')
          .update({
            ...formData,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            amount_due: total,
          })
          .eq('id', editingBill.id);

        if (billError) throw billError;

        await supabase
          .from('bill_lines')
          .delete()
          .eq('bill_id', editingBill.id);

        const { error: linesError } = await supabase
          .from('bill_lines')
          .insert(lineItems.map(line => ({
            bill_id: editingBill.id,
            ...line,
          })));

        if (linesError) throw linesError;
      } else {
        const billNumber = await generateBillNumber();
        const { data: billData, error: billError } = await supabase
          .from('bills')
          .insert([{
            ...formData,
            bill_number: billNumber,
            organization_id: currentOrganization.id,
            currency: currentOrganization.base_currency,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            amount_due: total,
            status: 'draft',
            created_by: user.id,
          }])
          .select()
          .single();

        if (billError) throw billError;

        const { error: linesError } = await supabase
          .from('bill_lines')
          .insert(lineItems.map(line => ({
            bill_id: billData.id,
            ...line,
          })));

        if (linesError) throw linesError;
      }

      await fetchBills();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving bill:', error);
      alert('Failed to save bill');
    }
  };

  const handleEdit = async (bill: Bill) => {
    setEditingBill(bill);
    setFormData({
      vendor_id: '',
      bill_date: bill.bill_date,
      due_date: bill.due_date || '',
      reference: '',
      notes: '',
    });

    const { data: lines } = await supabase
      .from('bill_lines')
      .select('*')
      .eq('bill_id', bill.id);

    if (lines && lines.length > 0) {
      setLineItems(lines);
    }

    setShowModal(true);
  };

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Are you sure you want to delete bill ${bill.bill_number}?`)) return;

    try {
      const { error } = await supabase
        .from('bills')
        .update({ status: 'void' })
        .eq('id', bill.id);

      if (error) throw error;
      await fetchBills();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBill(null);
    setFormData({
      vendor_id: '',
      bill_date: new Date().toISOString().split('T')[0],
      due_date: '',
      reference: '',
      notes: '',
    });
    setLineItems([{
      item_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_rate_id: null,
      tax_amount: 0,
      line_total: 0,
    }]);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      item_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_rate_id: null,
      tax_amount: 0,
      line_total: 0,
    }]);
  };

  const updateLineItem = (index: number, line: BillLineItemData) => {
    const newLines = [...lineItems];
    newLines[index] = line;
    setLineItems(newLines);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const filteredBills = bills.filter(bill =>
    bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (bill.vendor && bill.vendor.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentOrganization?.base_currency || 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 text-slate-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'void': return 'bg-gray-100 text-gray-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const totalPayables = bills
    .filter(bill => ['approved', 'partially_paid'].includes(bill.status))
    .reduce((sum, bill) => sum + bill.amount_due, 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Bills</h1>
          <p className="text-slate-600">Manage vendor bills and accounts payable</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          New Bill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Payables</span>
            <DollarSign className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalPayables)}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">This Month</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(
              bills
                .filter(b => new Date(b.bill_date).getMonth() === new Date().getMonth())
                .reduce((sum, b) => sum + b.total_amount, 0)
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Bills</span>
            <Receipt className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{bills.length}</div>
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
              placeholder="Search bills by number or vendor..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Bill #</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Due Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Total</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Due</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-600">
                    No bills found. Create your first bill to get started.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(bill.bill_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {bill.vendor?.name || '-'}
                        </div>
                        <div className="text-xs text-slate-600">
                          {bill.vendor?.vendor_number || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                        {bill.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(bill.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(bill.amount_due)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(bill)}
                        className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bill)}
                        className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"
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
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingBill ? 'Edit Bill' : 'New Bill'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Vendor *
                  </label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.vendor_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Bill Date *
                    </label>
                    <input
                      type="date"
                      value={formData.bill_date}
                      onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Line Items
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-600">ITEM</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-600">DESCRIPTION</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-600">QTY</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-600">PRICE</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-600">DISC %</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-600">TAX</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-600">TOTAL</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-slate-600">-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((line, index) => (
                        <BillLineItem
                          key={index}
                          line={line}
                          index={index}
                          items={items}
                          taxRates={taxRates}
                          onUpdate={updateLineItem}
                          onRemove={removeLineItem}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tax:</span>
                      <span className="font-medium text-slate-900">{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg border-t border-slate-200 pt-2">
                      <span className="font-bold text-slate-900">Total:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Internal notes"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  {editingBill ? 'Update Bill' : 'Create Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
