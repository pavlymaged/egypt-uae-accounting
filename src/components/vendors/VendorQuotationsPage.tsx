import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Search, CreditCard as Edit, Trash2, X, ChevronDown, ChevronRight, Download } from 'lucide-react';

interface QuotationLine {
  id?: string;
  item_description: string;
  profession: string;
  quantity: number;
  measurement_unit: string;
  rate_for_client: number;
  rate_for_office: number;
  tax_percent: number;
  total_amount_client: number;
  total_amount_office: number;
  line_order: number;
}

interface Quotation {
  id: string;
  quotation_number: string;
  vendor_id: string;
  project_id: string | null;
  quotation_date: string;
  description: string | null;
  total_amount: number;
  status: string;
  valid_until: string | null;
  notes: string | null;
  vendor?: { name: string };
  project?: { project_code: string; project_name: string } | null;
  lines?: QuotationLine[];
}

interface Vendor { id: string; name: string; }
interface Project { id: string; project_code: string; project_name: string; }
interface ServiceType { id: string; name: string; }

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-slate-100 text-slate-800',
};

const MEASUREMENT_UNITS = ['pcs', 'sqm', 'sqft', 'lm', 'kg', 'ton', 'hr', 'day', 'lot', 'set'];

const emptyLine: QuotationLine = {
  item_description: '', profession: '', quantity: 1, measurement_unit: 'pcs',
  rate_for_client: 0, rate_for_office: 0, tax_percent: 0,
  total_amount_client: 0, total_amount_office: 0, line_order: 0,
};

export default function VendorQuotationsPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    vendor_id: '', project_id: '',
    quotation_date: new Date().toISOString().split('T')[0],
    description: '', status: 'pending', valid_until: '', notes: '',
  });
  const [lines, setLines] = useState<QuotationLine[]>([{ ...emptyLine, line_order: 1 }]);

  useEffect(() => {
    if (currentOrganization) { fetchQuotations(); fetchVendors(); fetchProjects(); fetchServiceTypes(); }
  }, [currentOrganization]);

  const fetchQuotations = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('vendor_quotations')
        .select('*, vendor:vendors(name), project:projects(project_code, project_name)')
        .eq('organization_id', currentOrganization.id)
        .order('quotation_date', { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
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

  const fetchServiceTypes = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase.from('service_types').select('id, name').eq('organization_id', currentOrganization.id).eq('is_active', true).order('name');
    setServiceTypes(data || []);
  };

  const fetchLines = async (quotationId: string): Promise<QuotationLine[]> => {
    const { data } = await supabase
      .from('quotation_lines')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('line_order');
    return data || [];
  };

  const generateNumber = async () => {
    if (!currentOrganization) return 'QTN-0001';
    const { data } = await supabase.from('vendor_quotations').select('quotation_number').eq('organization_id', currentOrganization.id).order('created_at', { ascending: false }).limit(1);
    if (!data || data.length === 0) return 'QTN-0001';
    const match = data[0].quotation_number.match(/\d+$/);
    const next = match ? parseInt(match[0]) + 1 : 1;
    return `QTN-${String(next).padStart(4, '0')}`;
  };

  const calcLine = (line: QuotationLine): QuotationLine => {
    const totalClient = line.quantity * line.rate_for_client * (1 + line.tax_percent / 100);
    const totalOffice = line.quantity * line.rate_for_office * (1 + line.tax_percent / 100);
    return { ...line, total_amount_client: Math.round(totalClient * 100) / 100, total_amount_office: Math.round(totalOffice * 100) / 100 };
  };

  const updateLine = (index: number, field: keyof QuotationLine, value: string | number) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    updated[index] = calcLine(updated[index]);
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { ...emptyLine, line_order: lines.length + 1 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index).map((l, i) => ({ ...l, line_order: i + 1 })));
  };

  const totalClient = lines.reduce((s, l) => s + l.total_amount_client, 0);
  const totalOffice = lines.reduce((s, l) => s + l.total_amount_office, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;
    if (lines.some(l => !l.item_description.trim())) {
      alert('All line items must have a description');
      return;
    }
    try {
      if (editing) {
        const { error } = await supabase.from('vendor_quotations').update({
          vendor_id: formData.vendor_id, project_id: formData.project_id || null,
          quotation_date: formData.quotation_date, description: formData.description,
          total_amount: totalClient, status: formData.status,
          valid_until: formData.valid_until || null, notes: formData.notes,
        }).eq('id', editing.id);
        if (error) throw error;

        await supabase.from('quotation_lines').delete().eq('quotation_id', editing.id);
        const { error: linesError } = await supabase.from('quotation_lines').insert(
          lines.map(l => ({
            quotation_id: editing.id,
            item_description: l.item_description,
            profession: l.profession,
            quantity: l.quantity,
            measurement_unit: l.measurement_unit,
            rate_for_client: l.rate_for_client,
            rate_for_office: l.rate_for_office,
            tax_percent: l.tax_percent,
            total_amount_client: l.total_amount_client,
            total_amount_office: l.total_amount_office,
            line_order: l.line_order,
          }))
        );
        if (linesError) throw linesError;
      } else {
        const num = await generateNumber();
        const { data: inserted, error } = await supabase.from('vendor_quotations').insert([{
          quotation_number: num, vendor_id: formData.vendor_id,
          project_id: formData.project_id || null, quotation_date: formData.quotation_date,
          description: formData.description, total_amount: totalClient,
          status: formData.status, valid_until: formData.valid_until || null,
          notes: formData.notes, organization_id: currentOrganization.id, created_by: user.id,
        }]).select('id').maybeSingle();
        if (error) throw error;
        if (inserted) {
          const { error: linesError } = await supabase.from('quotation_lines').insert(
            lines.map(l => ({
              quotation_id: inserted.id,
              item_description: l.item_description,
              profession: l.profession,
              quantity: l.quantity,
              measurement_unit: l.measurement_unit,
              rate_for_client: l.rate_for_client,
              rate_for_office: l.rate_for_office,
              tax_percent: l.tax_percent,
              total_amount_client: l.total_amount_client,
              total_amount_office: l.total_amount_office,
              line_order: l.line_order,
            }))
          );
          if (linesError) throw linesError;
        }
      }
      await fetchQuotations();
      handleCloseModal();
    } catch (error) { console.error('Error:', error); alert('Failed to save quotation'); }
  };

  const handleEdit = async (q: Quotation) => {
    setEditing(q);
    setFormData({
      vendor_id: q.vendor_id, project_id: q.project_id || '',
      quotation_date: q.quotation_date, description: q.description || '',
      status: q.status, valid_until: q.valid_until || '', notes: q.notes || '',
    });
    const existingLines = await fetchLines(q.id);
    setLines(existingLines.length > 0 ? existingLines : [{ ...emptyLine, line_order: 1 }]);
    setShowModal(true);
  };

  const handleDelete = async (q: Quotation) => {
    if (!confirm(`Delete quotation ${q.quotation_number}?`)) return;
    await supabase.from('quotation_lines').delete().eq('quotation_id', q.id);
    const { error } = await supabase.from('vendor_quotations').delete().eq('id', q.id);
    if (!error) await fetchQuotations();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ vendor_id: '', project_id: '', quotation_date: new Date().toISOString().split('T')[0], description: '', status: 'pending', valid_until: '', notes: '' });
    setLines([{ ...emptyLine, line_order: 1 }]);
  };

  const toggleExpand = async (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      const q = quotations.find(q => q.id === id);
      if (q && !q.lines) {
        const lineData = await fetchLines(id);
        setQuotations(prev => prev.map(qq => qq.id === id ? { ...qq, lines: lineData } : qq));
      }
    }
    setExpandedRows(next);
  };

  const exportToCSV = () => {
    const headers = ['Number', 'Date', 'Vendor', 'Project', 'Status', 'Amount', 'Valid Until'];
    const rows = quotations.map(q => [
      q.quotation_number, q.quotation_date, `"${q.vendor?.name || ''}"`,
      q.project ? q.project.project_code : '', q.status,
      q.total_amount.toFixed(2), q.valid_until || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = quotations.filter(q =>
    q.quotation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.vendor?.name && q.vendor.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currentOrganization?.base_currency || 'USD' }).format(amount);

  if (loading) return <div className="p-8 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Vendor Quotations</h1>
          <p className="text-slate-600">Record and manage quotations with detailed line items</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
            <Plus className="w-5 h-5" />New Quotation
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search quotations..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Number</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Vendor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Project</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-600">No quotations found.</td></tr>
              ) : filtered.map((q) => (
                <>
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="px-3 py-4">
                      <button onClick={() => toggleExpand(q.id)} className="p-1 hover:bg-slate-100 rounded">
                        {expandedRows.has(q.id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{q.quotation_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(q.quotation_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{q.vendor?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{q.project ? q.project.project_code : '-'}</td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[q.status]}`}>{q.status}</span></td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">{formatCurrency(q.total_amount)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(q)} className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition mr-2"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(q)} className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  {expandedRows.has(q.id) && (
                    <tr key={`${q.id}-lines`}>
                      <td colSpan={8} className="bg-slate-50 px-6 py-4">
                        {q.lines && q.lines.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-500 uppercase">
                                <th className="text-left py-2 pr-3">#</th>
                                <th className="text-left py-2 pr-3">Description</th>
                                <th className="text-left py-2 pr-3">Profession</th>
                                <th className="text-right py-2 pr-3">Qty</th>
                                <th className="text-left py-2 pr-3">Unit</th>
                                <th className="text-right py-2 pr-3">Rate (Client)</th>
                                <th className="text-right py-2 pr-3">Rate (Office)</th>
                                <th className="text-right py-2 pr-3">Tax %</th>
                                <th className="text-right py-2 pr-3">Total (Client)</th>
                                <th className="text-right py-2">Total (Office)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {q.lines.map((line, i) => (
                                <tr key={line.id || i}>
                                  <td className="py-2 pr-3 text-slate-400">{line.line_order}</td>
                                  <td className="py-2 pr-3 text-slate-900">{line.item_description}</td>
                                  <td className="py-2 pr-3 text-slate-600">{line.profession || '-'}</td>
                                  <td className="py-2 pr-3 text-right text-slate-600">{line.quantity}</td>
                                  <td className="py-2 pr-3 text-slate-600">{line.measurement_unit}</td>
                                  <td className="py-2 pr-3 text-right text-slate-600">{formatCurrency(line.rate_for_client)}</td>
                                  <td className="py-2 pr-3 text-right text-slate-600">{formatCurrency(line.rate_for_office)}</td>
                                  <td className="py-2 pr-3 text-right text-slate-600">{line.tax_percent}%</td>
                                  <td className="py-2 pr-3 text-right font-medium text-slate-900">{formatCurrency(line.total_amount_client)}</td>
                                  <td className="py-2 text-right font-medium text-blue-600">{formatCurrency(line.total_amount_office)}</td>
                                </tr>
                              ))}
                              <tr className="font-bold border-t-2 border-slate-300">
                                <td colSpan={8} className="py-2 pr-3 text-right">Totals</td>
                                <td className="py-2 pr-3 text-right text-slate-900">{formatCurrency(q.lines.reduce((s, l) => s + l.total_amount_client, 0))}</td>
                                <td className="py-2 text-right text-blue-600">{formatCurrency(q.lines.reduce((s, l) => s + l.total_amount_office, 0))}</td>
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-slate-500 text-sm">No line items recorded.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-2xl font-bold text-slate-900">{editing ? 'Edit Quotation' : 'New Quotation'}</h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vendor *</label>
                  <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="">Select vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project</label>
                  <select value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.project_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <input type="date" value={formData.quotation_date} onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Valid Until</label>
                  <input type="date" value={formData.valid_until} onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Line Items</label>
                  <button type="button" onClick={addLine} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    <Plus className="w-4 h-4" />Add Line
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 w-8">#</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Description *</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Profession</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 w-20">Qty</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 w-24">Unit</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 w-28">Rate (Client)</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 w-28">Rate (Office)</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 w-20">Tax %</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 w-28">Total (Client)</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 w-28">Total (Office)</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lines.map((line, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2">
                              <input type="text" value={line.item_description} onChange={(e) => updateLine(i, 'item_description', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Item description" required />
                            </td>
                            <td className="px-3 py-2">
                              <select value={line.profession} onChange={(e) => updateLine(i, 'profession', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">-</option>
                                {serviceTypes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" min="0" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={line.measurement_unit} onChange={(e) => updateLine(i, 'measurement_unit', e.target.value)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                                {MEASUREMENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" min="0" value={line.rate_for_client} onChange={(e) => updateLine(i, 'rate_for_client', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" min="0" value={line.rate_for_office} onChange={(e) => updateLine(i, 'rate_for_office', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.01" min="0" value={line.tax_percent} onChange={(e) => updateLine(i, 'tax_percent', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(line.total_amount_client)}</td>
                            <td className="px-3 py-2 text-right font-medium text-blue-600">{formatCurrency(line.total_amount_office)}</td>
                            <td className="px-3 py-2">
                              {lines.length > 1 && (
                                <button type="button" onClick={() => removeLine(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr className="font-bold">
                          <td colSpan={8} className="px-3 py-3 text-right text-sm text-slate-700">Totals</td>
                          <td className="px-3 py-3 text-right text-sm text-slate-900">{formatCurrency(totalClient)}</td>
                          <td className="px-3 py-3 text-right text-sm text-blue-600">{formatCurrency(totalOffice)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">{editing ? 'Update' : 'Create Quotation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
