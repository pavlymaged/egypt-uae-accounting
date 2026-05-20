import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, X, CreditCard, Calendar, DollarSign } from 'lucide-react';

interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  tax_amount: number;
  payment_method: string;
  reference: string | null;
  description: string | null;
  is_billable: boolean;
  vendor?: {
    name: string;
  };
  account?: {
    name: string;
    code: string;
  };
}

interface Vendor {
  id: string;
  name: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

export default function ExpensesPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    account_id: '',
    amount: 0,
    tax_amount: 0,
    payment_method: 'cash' as 'cash' | 'bank_transfer' | 'card' | 'other',
    reference: '',
    description: '',
    is_billable: false,
    notes: '',
  });

  useEffect(() => {
    if (currentOrganization) {
      fetchExpenses();
      fetchVendors();
      fetchAccounts();
    }
  }, [currentOrganization]);

  const fetchExpenses = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vendor:vendors(name),
          account:accounts(name, code)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchAccounts = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .eq('account_type', 'expense')
        .order('code');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const generateExpenseNumber = async () => {
    if (!currentOrganization) return 'EXP-0001';

    const { data } = await supabase
      .from('expenses')
      .select('expense_number')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'EXP-0001';

    const lastNumber = data[0].expense_number;
    const match = lastNumber.match(/\d+$/);
    const nextNumber = match ? parseInt(match[0]) + 1 : 1;
    return `EXP-${String(nextNumber).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;

    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            ...formData,
            vendor_id: formData.vendor_id || null,
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
      } else {
        const expenseNumber = await generateExpenseNumber();
        const { error } = await supabase
          .from('expenses')
          .insert([{
            ...formData,
            expense_number: expenseNumber,
            organization_id: currentOrganization.id,
            vendor_id: formData.vendor_id || null,
            created_by: user.id,
          }]);

        if (error) throw error;
      }

      await fetchExpenses();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense');
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      expense_date: expense.expense_date,
      vendor_id: '',
      account_id: '',
      amount: expense.amount,
      tax_amount: expense.tax_amount,
      payment_method: expense.payment_method as 'cash' | 'bank_transfer' | 'card' | 'other',
      reference: expense.reference || '',
      description: expense.description || '',
      is_billable: expense.is_billable,
      notes: '',
    });
    setShowModal(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Are you sure you want to delete expense ${expense.expense_number}?`)) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;
      await fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingExpense(null);
    setFormData({
      expense_date: new Date().toISOString().split('T')[0],
      vendor_id: '',
      account_id: '',
      amount: 0,
      tax_amount: 0,
      payment_method: 'cash',
      reference: '',
      description: '',
      is_billable: false,
      notes: '',
    });
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.expense_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (expense.description && expense.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (expense.vendor && expense.vendor.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentOrganization?.base_currency || 'USD',
    }).format(amount);
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Expenses</h1>
          <p className="text-slate-600">Track and categorize business expenses</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Expenses</span>
            <CreditCard className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">This Month</span>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(
              expenses
                .filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth())
                .reduce((sum, e) => sum + e.amount, 0)
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Total Count</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{expenses.length}</div>
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
              placeholder="Search expenses by number, description, or vendor..."
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Payment</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-600">
                    No expenses found. Add your first expense to get started.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {expense.expense_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {expense.vendor?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {expense.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {expense.account ? `${expense.account.code} - ${expense.account.name}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">
                        {expense.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense)}
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Vendor
                  </label>
                  <select
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select vendor (optional)</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Expense Category *
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select category</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="What was this expense for?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <DollarSign className="w-4 h-4 inline" />
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tax Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tax_amount}
                    onChange={(e) => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Method *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reference
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Receipt number, etc."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_billable"
                  checked={formData.is_billable}
                  onChange={(e) => setFormData({ ...formData, is_billable: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_billable" className="text-sm font-medium text-slate-700">
                  This expense is billable to a customer
                </label>
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
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
