import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, CreditCard as Edit, Eye, X, Loader2, Image as ImageIcon, Clock, AlertTriangle } from 'lucide-react';

interface EngineerExpense {
  id: string;
  engineer_id: string;
  expense_date: string;
  amount: number;
  tax: number;
  description: string;
  category: string;
  profession: string;
  project_id: string | null;
  payment_method: string;
  receipt_photo_url: string;
  status: string;
  accountant_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  engineer?: { name: string; email: string } | null;
  project?: { project_code: string; project_name: string } | null;
}

const statusColors: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Amended: 'bg-blue-100 text-blue-800',
};

export default function EngineerExpenseReviewPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<EngineerExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [viewingExpense, setViewingExpense] = useState<EngineerExpense | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'amend' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) fetchExpenses();
  }, [currentOrganization, statusFilter]);

  const fetchExpenses = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      let query = supabase
        .from('engineer_expenses')
        .select('*, engineer:site_engineers(name, email), project:projects(project_code, project_name)')
        .eq('organization_id', currentOrganization.id)
        .order('submitted_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReceiptUrl = async (path: string) => {
    if (!path) { setReceiptUrl(null); return; }
    const { data } = await supabase.storage.from('engineer-receipts').createSignedUrl(path, 3600);
    setReceiptUrl(data?.signedUrl || null);
  };

  const handleViewExpense = async (expense: EngineerExpense) => {
    setViewingExpense(expense);
    setActionNotes(expense.accountant_notes || '');
    setActionType(null);
    setFeedback(null);
    if (expense.receipt_photo_url) {
      await loadReceiptUrl(expense.receipt_photo_url);
    } else {
      setReceiptUrl(null);
    }
  };

  const handleApprove = async () => {
    if (!viewingExpense || !user || !currentOrganization) return;
    setProcessing(true);
    setFeedback(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/approve-engineer-expense`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          expense_id: viewingExpense.id,
          accountant_notes: actionNotes,
          organization_id: currentOrganization.id,
          reviewer_id: user.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      setFeedback({ kind: 'success', message: 'Expense approved and recorded to main ledger.' });
      await fetchExpenses();
      setTimeout(() => setViewingExpense(null), 1200);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Approval failed.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!viewingExpense || !user || !actionNotes.trim()) {
      setFeedback({ kind: 'error', message: 'Rejection reason is required.' });
      return;
    }
    setProcessing(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('engineer_expenses').update({
        status: 'Rejected',
        accountant_notes: actionNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user!.id,
      }).eq('id', viewingExpense.id);
      if (error) throw error;
      setFeedback({ kind: 'success', message: 'Expense rejected.' });
      await fetchExpenses();
      setTimeout(() => setViewingExpense(null), 1200);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to reject.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setProcessing(false);
    }
  };

  const handleAmend = async () => {
    if (!viewingExpense || !user || !actionNotes.trim()) {
      setFeedback({ kind: 'error', message: 'Amendment notes are required.' });
      return;
    }
    setProcessing(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('engineer_expenses').update({
        status: 'Amended',
        accountant_notes: actionNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user!.id,
      }).eq('id', viewingExpense.id);
      if (error) throw error;
      setFeedback({ kind: 'success', message: 'Expense flagged for amendment.' });
      await fetchExpenses();
      setTimeout(() => setViewingExpense(null), 1200);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to flag for amendment.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  const pendingCount = expenses.filter(e => e.status === 'Pending').length;

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Engineer Expense Review</h1>
          <p className="text-slate-600">Review and approve expenses submitted by site engineers</p>
        </div>
        {statusFilter !== 'Pending' && pendingCount > 0 && (
          <button onClick={() => setStatusFilter('Pending')} className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg border border-yellow-200 hover:bg-yellow-200 transition">
            <Clock className="w-4 h-4" />{pendingCount} Pending
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {['Pending', 'Approved', 'Rejected', 'Amended', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm transition capitalize ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >{s === 'all' ? 'All' : s}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Engineer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Description</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {expenses.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-600">No expenses found.</td></tr>
              ) : expenses.map(expense => (
                <tr key={expense.id} onClick={() => handleViewExpense(expense)} className="hover:bg-blue-50/50 cursor-pointer transition">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{expense.engineer?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(expense.expense_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{expense.description}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{expense.category}</span></td>
                  <td className="px-6 py-4 text-sm text-slate-600">{expense.project?.project_code || '-'}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(expense.amount)}</td>
                  <td className="px-6 py-4 text-center"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[expense.status]}`}>{expense.status}</span></td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleViewExpense(expense)} className="text-slate-600 hover:text-slate-900 p-2 hover:bg-slate-100 rounded transition" title="View"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingExpense && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewingExpense(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Expense Details</h2>
                <p className="text-sm text-slate-600 mt-0.5">Submitted by {viewingExpense.engineer?.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[viewingExpense.status]}`}>{viewingExpense.status}</span>
                <button onClick={() => setViewingExpense(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>{feedback.message}</div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Date" value={new Date(viewingExpense.expense_date).toLocaleDateString()} />
                <Field label="Amount" value={formatCurrency(viewingExpense.amount)} bold />
                <Field label="Tax" value={formatCurrency(viewingExpense.tax)} />
                <Field label="Category" value={viewingExpense.category} />
                <Field label="Profession" value={viewingExpense.profession || '-'} />
                <Field label="Project" value={viewingExpense.project ? `${viewingExpense.project.project_code} - ${viewingExpense.project.project_name}` : '-'} />
                <Field label="Payment Method" value={viewingExpense.payment_method?.replace(/_/g, ' ') || 'Employee Advance'} />
                <Field label="Submitted" value={new Date(viewingExpense.submitted_at).toLocaleString()} />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Description</div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{viewingExpense.description}</p>
              </div>

              {receiptUrl && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Receipt Photo</div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                    <img src={receiptUrl} alt="Receipt" className="max-h-80 w-auto mx-auto object-contain" />
                  </div>
                </div>
              )}

              {viewingExpense.status === 'Pending' && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes to Engineer</label>
                    <textarea
                      value={actionNotes}
                      onChange={e => setActionNotes(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Required for rejection/amendment..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleApprove} disabled={processing} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition">
                      {processing && actionType === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve
                    </button>
                    <button onClick={() => { setActionType('reject'); handleReject(); }} disabled={processing} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg transition">
                      {processing && actionType === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Reject
                    </button>
                    <button onClick={() => { setActionType('amend'); handleAmend(); }} disabled={processing} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition">
                      {processing && actionType === 'amend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />} Amend
                    </button>
                  </div>
                </div>
              )}

              {viewingExpense.accountant_notes && viewingExpense.status !== 'Pending' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs uppercase tracking-wide text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Accountant Notes</div>
                  <p className="text-sm text-amber-900">{viewingExpense.accountant_notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setViewingExpense(null)} className="w-full px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">{label}</div>
      <div className={`text-sm text-slate-900 ${bold ? 'font-bold text-base' : 'font-medium'}`}>{value}</div>
    </div>
  );
}
