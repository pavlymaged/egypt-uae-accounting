import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, X, FileText, Calendar, DollarSign } from 'lucide-react';
import { InvoiceLineItem, InvoiceLineItemData } from './InvoiceLineItem';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  customer?: {
    name: string;
    customer_number: string;
  };
}

interface Customer {
  id: string;
  name: string;
  customer_number: string;
}

interface Item {
  id: string;
  name: string;
  sales_price: number;
}

interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

export default function InvoicesPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const [formData, setFormData] = useState({
    invoice_type: 'invoice' as 'invoice' | 'quote',
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    reference: '',
    notes: '',
    terms_and_conditions: '',
  });

  const [lineItems, setLineItems] = useState<InvoiceLineItemData[]>([{
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
      fetchInvoices();
      fetchCustomers();
      fetchItems();
      fetchTaxRates();
    }
  }, [currentOrganization]);

  const fetchInvoices = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(name, customer_number)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, customer_number')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchItems = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, sales_price')
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

  const generateInvoiceNumber = async () => {
    if (!currentOrganization) return 'INV-0001';

    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'INV-0001';

    const lastNumber = data[0].invoice_number;
    const match = lastNumber.match(/\d+$/);
    const nextNumber = match ? parseInt(match[0]) + 1 : 1;
    return `INV-${String(nextNumber).padStart(4, '0')}`;
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
    if (!currentOrganization || !user || !formData.customer_id) {
      alert('Please select a customer');
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    try {
      if (editingInvoice) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            ...formData,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            amount_due: total,
          })
          .eq('id', editingInvoice.id);

        if (invoiceError) throw invoiceError;

        await supabase
          .from('invoice_lines')
          .delete()
          .eq('invoice_id', editingInvoice.id);

        const { error: linesError } = await supabase
          .from('invoice_lines')
          .insert(lineItems.map(line => ({
            invoice_id: editingInvoice.id,
            ...line,
          })));

        if (linesError) throw linesError;
      } else {
        const invoiceNumber = await generateInvoiceNumber();
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            ...formData,
            invoice_number: invoiceNumber,
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

        if (invoiceError) throw invoiceError;

        const { error: linesError } = await supabase
          .from('invoice_lines')
          .insert(lineItems.map(line => ({
            invoice_id: invoiceData.id,
            ...line,
          })));

        if (linesError) throw linesError;
      }

      await fetchInvoices();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice');
    }
  };

  const handleEdit = async (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoice_type: 'invoice',
      customer_id: '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      reference: '',
      notes: '',
      terms_and_conditions: '',
    });

    const { data: lines } = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (lines && lines.length > 0) {
      setLineItems(lines);
    }

    setShowModal(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}?`)) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'void' })
        .eq('id', invoice.id);

      if (error) throw error;
      await fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingInvoice(null);
    setFormData({
      invoice_type: 'invoice',
      customer_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      reference: '',
      notes: '',
      terms_and_conditions: '',
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

  const updateLineItem = (index: number, line: InvoiceLineItemData) => {
    const newLines = [...lineItems];
    newLines[index] = line;
    setLineItems(newLines);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (invoice.customer && invoice.customer.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'void': return 'bg-gray-100 text-gray-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total_amount, 0);

  const totalOutstanding = invoices
    .filter(inv => ['sent', 'partially_paid', 'overdue'].includes(inv.status))
    .reduce((sum, inv) => sum + inv.amount_due, 0);

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Invoices</h1>
          <p className="text-slate-600">Create and manage sales invoices and quotes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Revenue</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Outstanding</span>
            <FileText className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding)}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Invoices</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{invoices.length}</div>
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
              placeholder="Search invoices by number or customer..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Invoice #</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Due Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Total</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Due</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-600">
                    No invoices found. Create your first invoice to get started.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {invoice.customer?.name || '-'}
                        </div>
                        <div className="text-xs text-slate-600">
                          {invoice.customer?.customer_number || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(invoice.amount_due)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(invoice)}
                        className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice)}
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
                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.customer_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Invoice Date *
                    </label>
                    <input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
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
                        <InvoiceLineItem
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Internal notes (not visible to customer)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Payment terms, conditions, etc."
                  />
                </div>
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
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
