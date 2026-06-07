import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, DollarSign, Calendar, Paperclip } from 'lucide-react';
import AttachmentsManager from '../attachments/AttachmentsManager';
import VendorPaymentRecordModal, { PaymentRecord } from './VendorPaymentRecordModal';

interface VendorPayment {
  id: string;
  payment_number: string;
  vendor_id: string;
  project_id: string | null;
  quotation_id: string | null;
  payment_date: string;
  amount: number;
  client_amount: number;
  office_amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  employee_advance_id?: string | null;
  vendor?: { name: string };
  project?: { project_code: string; project_name: string } | null;
}

interface Vendor { id: string; name: string; }
interface Project { id: string; project_code: string; project_name: string; }
interface Quotation { id: string; quotation_number: string; total_amount: number; vendor_id: string; project_id: string | null; }
interface QuotationLine { total_amount_client: number; total_amount_office: number; }
interface EmployeeAdvanceOption { id: string; advance_number: string; employee_name: string; remaining_balance: number; }

interface QuotationSummary {
  quotationId: string;
  quotationNumber: string;
  vendorName: string;
  projectId: string | null;
  clientTotal: number;
  officeTotal: number;
  clientPaid: number;
  officePaid: number;
}

export default function VendorPaymentsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [employeeAdvances, setEmployeeAdvances] = useState<EmployeeAdvanceOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<VendorPayment | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [quotationSummary, setQuotationSummary] = useState<QuotationSummary | null>(null);
  const [selectQuotationModal, setSelectQuotationModal] = useState(false);
  const [selectedVendorForRecord, setSelectedVendorForRecord] = useState('');
  const [selectedQuotationForRecord, setSelectedQuotationForRecord] = useState('');

  const [formData, setFormData] = useState({
    vendor_id: '',
    project_id: '',
    quotation_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'cash',
    reference: '',
    employee_advance_id: '',
    notes: '',
  });

  useEffect(() => {
    if (currentOrganization) { fetchPayments(); fetchVendors(); fetchProjects(); fetchQuotations(); fetchEmployeeAdvances(); }
  }, [currentOrganization]);

  const fetchEmployeeAdvances = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase
      .from('employee_advances')
      .select('id, advance_number, employee_name, remaining_balance')
      .eq('organization_id', currentOrganization.id)
      .order('advance_date', { ascending: false });
    setEmployeeAdvances((data || []).filter(a => a.remaining_balance > 0));
  };

  const fetchPayments = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase.from('vendor_project_payments').select('*, vendor:vendors(name), project:projects(project_code, project_name)').eq('organization_id', currentOrganization.id).order('payment_date', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
      const ids = (data || []).map(d => d.id);
      if (ids.length) {
        const { data: atts } = await supabase
          .from('attachments').select('entity_id')
          .eq('entity_type', 'vendor_payment').in('entity_id', ids);
        const counts: Record<string, number> = {};
        (atts || []).forEach((a: { entity_id: string }) => { counts[a.entity_id] = (counts[a.entity_id] || 0) + 1; });
        setAttachmentCounts(counts);
      } else setAttachmentCounts({});
    } catch (error) { console.error('Error:', error); } finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('vendors').select('id, name').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
    setVendors(data || []);
  };

  const fetchProjects = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('projects').select('id, project_code, project_name').eq('organization_id', currentOrganization.id).eq('project_status', 'active').order('project_code');
    setProjects(data || []);
  };

  const fetchQuotations = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('vendor_quotations').select('id, quotation_number, total_amount, vendor_id, project_id').eq('organization_id', currentOrganization.id).eq('status', 'approved').order('quotation_number');
    setQuotations(data || []);
  };

  const loadQuotationSummary = async (quotationId: string) => {
    if (!currentOrganization) return;
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) return;

    const vendor = vendors.find(v => v.id === quotation.vendor_id);

    const { data: lines } = await supabase
      .from('quotation_lines')
      .select('total_amount_client, total_amount_office')
      .eq('quotation_id', quotationId);

    const clientTotal = (lines || []).reduce((s: number, l: QuotationLine) => s + Number(l.total_amount_client), 0);
    const officeTotal = (lines || []).reduce((s: number, l: QuotationLine) => s + Number(l.total_amount_office), 0);

    const { data: existingPayments } = await supabase
      .from('vendor_project_payments')
      .select('client_amount, office_amount')
      .eq('quotation_id', quotationId)
      .eq('organization_id', currentOrganization.id);

    const clientPaid = (existingPayments || []).reduce((s: number, p: any) => s + Number(p.client_amount || 0), 0);
    const officePaid = (existingPayments || []).reduce((s: number, p: any) => s + Number(p.office_amount || 0), 0);

    setQuotationSummary({
      quotationId,
      quotationNumber: quotation.quotation_number,
      vendorName: vendor?.name || 'Unknown Vendor',
      projectId: quotation.project_id,
      clientTotal,
      officeTotal,
      clientPaid,
      officePaid,
    });
    setSelectQuotationModal(false);
    setShowRecordModal(true);
  };

  const handleRecordPayment = async (paymentData: PaymentRecord) => {
    if (!currentOrganization || !user || !quotationSummary) return;
    try {
      const num = await generateNumber();
      const totalAmount = paymentData.clientAmount + paymentData.officeAmount;
      const { error } = await supabase.from('vendor_project_payments').insert([{
        payment_number: num,
        organization_id: currentOrganization.id,
        vendor_id: vendors.find(v => v.name === quotationSummary.vendorName)?.id || selectedVendorForRecord,
        project_id: quotationSummary.projectId,
        quotation_id: quotationSummary.quotationId,
        payment_date: paymentData.date,
        amount: totalAmount,
        client_amount: paymentData.clientAmount,
        office_amount: paymentData.officeAmount,
        payment_method: paymentData.method,
        reference: paymentData.reference || null,
        notes: null,
        created_by: user.id,
      }]);
      if (error) throw error;
      setShowRecordModal(false);
      setQuotationSummary(null);
      setSelectedVendorForRecord('');
      setSelectedQuotationForRecord('');
      await fetchPayments();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment.');
    }
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'VPMT-0001';
    const { data } = await supabase.from('vendor_project_payments').select('payment_number').eq('organization_id', currentOrganization.id).order('created_at', { ascending: false }).limit(1);
    if (!data || data.length === 0) return 'VPMT-0001';
    const match = data[0].payment_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `VPMT-${String(next).padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    setFeedback(null);

    if (formData.payment_method === 'employee_advance' && !formData.employee_advance_id) {
      setFeedback({ kind: 'error', message: 'Please select an employee advance to draw from.' });
      return;
    }
    const advance = employeeAdvances.find(a => a.id === formData.employee_advance_id);
    if (formData.payment_method === 'employee_advance' && advance && formData.amount > advance.remaining_balance && !editing) {
      setFeedback({ kind: 'error', message: `Amount exceeds remaining advance balance (${advance.remaining_balance}).` });
      return;
    }

    setSubmitting(true);
    try {
      const useAdvance = formData.payment_method === 'employee_advance';
      const basePayload = {
        vendor_id: formData.vendor_id,
        project_id: formData.project_id || null,
        quotation_id: formData.quotation_id || null,
        payment_date: formData.payment_date,
        amount: formData.amount,
        payment_method: formData.payment_method,
        reference: formData.reference,
        notes: formData.notes,
        employee_advance_id: useAdvance ? formData.employee_advance_id : null,
      };

      if (editing) {
        const { error } = await supabase.from('vendor_project_payments').update(basePayload).eq('id', editing.id);
        if (error) throw error;
        setFeedback({ kind: 'success', message: 'Payment updated.' });
      } else {
        const num = await generateNumber();
        const { data: inserted, error } = await supabase.from('vendor_project_payments').insert([{
          ...basePayload,
          payment_number: num,
          organization_id: currentOrganization.id,
          created_by: user.id,
        }]).select('*, vendor:vendors(name), project:projects(project_code, project_name)').single();
        if (error) throw error;

        if (useAdvance && advance) {
          const newBalance = Math.max(0, advance.remaining_balance - formData.amount);
          await supabase.from('employee_advances').update({ remaining_balance: newBalance }).eq('id', advance.id);
        }

        await fetchPayments();
        await fetchEmployeeAdvances();
        if (inserted) {
          setFeedback({
            kind: 'success',
            message: useAdvance && advance
              ? `Payment saved. Drawn from advance ${advance.advance_number} (${advance.employee_name}).`
              : 'Payment saved.',
          });
          setEditing(inserted as VendorPayment);
          return;
        }
      }
      await fetchPayments();
      await fetchEmployeeAdvances();
      handleCloseModal();
    } catch (error) {
      console.error('Error:', error);
      setFeedback({ kind: 'error', message: 'Failed to save payment.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (p: VendorPayment) => {
    setEditing(p);
    setFormData({ vendor_id: p.vendor_id, project_id: p.project_id || '', quotation_id: p.quotation_id || '', payment_date: p.payment_date, amount: p.amount, payment_method: p.payment_method, reference: p.reference || '', employee_advance_id: p.employee_advance_id || '', notes: p.notes || '' });
    setShowModal(true);
  };

  const handleDelete = async (p: VendorPayment) => {
    if (!confirm(`Delete payment ${p.payment_number}?`)) return;
    const { error } = await supabase.from('vendor_project_payments').delete().eq('id', p.id);
    if (!error) await fetchPayments();
  };

  const handleCloseModal = () => {
    setShowModal(false); setEditing(null);
    setFormData({ vendor_id: '', project_id: '', quotation_id: '', payment_date: new Date().toISOString().split('T')[0], amount: 0, payment_method: 'cash', reference: '', employee_advance_id: '', notes: '' });
    setFeedback(null);
  };

  const filtered = payments.filter(p =>
    p.payment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.vendor?.name && p.vendor.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const filteredQuotations = formData.vendor_id ? quotations.filter(q => q.vendor_id === formData.vendor_id) : quotations;
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Vendor Payments</h1>
          <p className="text-slate-600">Record payments to vendors</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectQuotationModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"><Plus className="w-5 h-5" />Record Payment</button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition"><Plus className="w-5 h-5" />Quick Payment</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">Total Paid</span><DollarSign className="w-5 h-5 text-red-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalPayments)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-slate-600">This Month</span><Calendar className="w-5 h-5 text-blue-600" /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(payments.filter(p => new Date(p.payment_date).getMonth() === new Date().getMonth()).reduce((s, p) => s + p.amount, 0))}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search payments..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Method</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-600">No payments found.</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {p.payment_number}
                      {attachmentCounts[p.id] > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500" title={`${attachmentCounts[p.id]} attachment(s)`}>
                          <Paperclip className="w-3 h-3" />{attachmentCounts[p.id]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{p.vendor?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{p.project ? p.project.project_code : '-'}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 capitalize">{p.payment_method.replace('_', ' ')}</span></td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(p.amount)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="text-2xl font-bold text-slate-900">{editing ? 'Edit Payment' : 'Quick Payment'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {feedback && (
                <div className={`px-3 py-2 rounded-lg text-sm border ${feedback.kind === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {feedback.message}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Vendor *</label>
                <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value, quotation_id: '' })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Select vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project</label>
                  <select value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quotation</label>
                  <select value={formData.quotation_id} onChange={(e) => setFormData({ ...formData, quotation_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">No quotation</option>
                    {filteredQuotations.map(q => <option key={q.id} value={q.id}>{q.quotation_number} ({formatCurrency(q.total_amount)})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method *</label>
                  <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value, employee_advance_id: e.target.value === 'employee_advance' ? formData.employee_advance_id : '' })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="check">Check</option><option value="card">Card</option><option value="employee_advance">Employee Advance</option><option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Reference</label>
                  <input type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {formData.payment_method === 'employee_advance' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <label className="block text-sm font-medium text-amber-900">Draw from Employee Advance *</label>
                  {employeeAdvances.length === 0 ? (
                    <p className="text-xs text-amber-700">No advances with available balance. Create one in Employee Advances.</p>
                  ) : (
                    <select value={formData.employee_advance_id} onChange={(e) => setFormData({ ...formData, employee_advance_id: e.target.value })} className="w-full px-4 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" required>
                      <option value="">Select advance</option>
                      {employeeAdvances.map(a => (
                        <option key={a.id} value={a.id}>{a.advance_number} - {a.employee_name} ({formatCurrency(a.remaining_balance)} available)</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-amber-700">The advance's remaining balance will be reduced by this amount when saved.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              {currentOrganization && (
                <div className="pt-2 border-t border-slate-200">
                  <AttachmentsManager organizationId={currentOrganization.id} entityType="vendor_payment" entityId={editing?.id || null} />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition">{submitting ? 'Saving...' : editing ? 'Update' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectQuotationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Select Quotation for Payment</h2>
              <button onClick={() => { setSelectQuotationModal(false); setSelectedVendorForRecord(''); setSelectedQuotationForRecord(''); }} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Vendor *</label>
                <select value={selectedVendorForRecord} onChange={(e) => { setSelectedVendorForRecord(e.target.value); setSelectedQuotationForRecord(''); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quotation *</label>
                <select value={selectedQuotationForRecord} onChange={(e) => setSelectedQuotationForRecord(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select quotation</option>
                  {quotations.filter(q => q.vendor_id === selectedVendorForRecord).map(q => (
                    <option key={q.id} value={q.id}>{q.quotation_number} ({formatCurrency(q.total_amount)})</option>
                  ))}
                </select>
              </div>
              {selectedVendorForRecord && quotations.filter(q => q.vendor_id === selectedVendorForRecord).length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">No approved quotations for this vendor.</p>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setSelectQuotationModal(false); setSelectedVendorForRecord(''); setSelectedQuotationForRecord(''); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="button" disabled={!selectedQuotationForRecord} onClick={() => loadQuotationSummary(selectedQuotationForRecord)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition">Continue</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRecordModal && quotationSummary && (
        <VendorPaymentRecordModal
          vendorName={quotationSummary.vendorName}
          quotationNumber={quotationSummary.quotationNumber}
          clientTotalQuotation={quotationSummary.clientTotal}
          officeTotalQuotation={quotationSummary.officeTotal}
          clientPreviouslyPaid={quotationSummary.clientPaid}
          officePreviouslyPaid={quotationSummary.officePaid}
          currency={currentOrganization?.base_currency || 'USD'}
          onSubmit={handleRecordPayment}
          onCancel={() => { setShowRecordModal(false); setQuotationSummary(null); }}
        />
      )}
    </div>
  );
}
