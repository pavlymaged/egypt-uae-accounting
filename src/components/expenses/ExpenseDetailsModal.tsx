import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Calendar, FileText, ExternalLink, Image as ImageIcon, ChevronLeft, ChevronRight,
  Download, Paperclip, Loader2, CreditCard as Edit, Trash2, Receipt, Tag, HardHat, User, Hash,
} from 'lucide-react';

interface ProjectExpenseLike {
  id: string;
  expense_number: string;
  expense_date: string;
  description: string;
  amount: number;
  payment_method: string | null;
  category: string | null;
  profession: string | null;
  vendor_name_text: string | null;
  trn_text: string | null;
  tax_included: boolean;
  status?: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  project?: { project_code: string; project_name: string } | null;
  vendor?: { name: string } | null;
}

interface Attachment {
  id: string;
  kind: 'file' | 'link';
  file_name: string;
  file_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  external_url: string | null;
  created_at: string;
}

interface Props {
  expense: ProjectExpenseLike;
  entityType: 'site_expense' | 'general_expense';
  currency: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const BUCKET = 'attachments';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

export default function ExpenseDetailsModal({ expense, entityType, currency, onClose, onEdit, onDelete }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('attachments')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', expense.id)
          .order('created_at', { ascending: false });
        if (err) throw err;
        const list = (data || []) as Attachment[];
        setAttachments(list);

        const paths = list.filter(a => a.kind === 'file' && a.file_path).map(a => a.file_path!);
        if (paths.length) {
          const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
          const map: Record<string, string> = {};
          (urls || []).forEach((u, i) => { if (u.signedUrl) map[paths[i]] = u.signedUrl; });
          setSigned(map);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load attachments');
      } finally {
        setLoading(false);
      }
    })();
  }, [expense.id, entityType]);

  const images = useMemo(
    () => attachments.filter(a => a.kind === 'file' && isImage(a.mime_type) && a.file_path && signed[a.file_path]),
    [attachments, signed]
  );
  const otherFiles = useMemo(
    () => attachments.filter(a => a.kind === 'file' && !isImage(a.mime_type)),
    [attachments]
  );
  const links = useMemo(() => attachments.filter(a => a.kind === 'link'), [attachments]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) setLightboxIndex(null);
        else onClose();
      }
      if (lightboxIndex !== null) {
        if (e.key === 'ArrowRight') setLightboxIndex((lightboxIndex + 1) % images.length);
        if (e.key === 'ArrowLeft') setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, images.length, onClose]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const formatDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString() : '-';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-gradient-to-r from-slate-50 to-white">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide mb-1">
              <Hash className="w-3.5 h-3.5" />
              {expense.expense_number}
              {expense.status && (
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                  expense.status === 'confirmed' ? 'bg-green-100 text-green-800'
                  : expense.status === 'rejected' ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
                }`}>{expense.status}</span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{expense.description}</h2>
            <div className="text-3xl font-bold text-blue-600 mt-2">{formatCurrency(expense.amount)}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailField icon={<Calendar className="w-4 h-4" />} label="Date" value={new Date(expense.expense_date).toLocaleDateString()} />
            <DetailField icon={<HardHat className="w-4 h-4" />} label="Project" value={expense.project ? `${expense.project.project_code} - ${expense.project.project_name}` : '-'} />
            <DetailField icon={<Tag className="w-4 h-4" />} label="Category" value={expense.category || '-'} capitalize />
            <DetailField icon={<User className="w-4 h-4" />} label="Profession" value={expense.profession || '-'} />
            <DetailField icon={<Receipt className="w-4 h-4" />} label="Payment Method" value={(expense.payment_method || '-').replace(/_/g, ' ')} capitalize />
            <DetailField icon={<User className="w-4 h-4" />} label="Vendor" value={expense.vendor?.name || expense.vendor_name_text || '-'} />
            <DetailField icon={<FileText className="w-4 h-4" />} label="TRN" value={expense.trn_text || '-'} mono />
            <DetailField icon={<Tag className="w-4 h-4" />} label="Tax Included" value={expense.tax_included ? 'Yes' : 'No'} />
            <DetailField icon={<Calendar className="w-4 h-4" />} label="Created" value={formatDate(expense.created_at)} />
          </div>

          {expense.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 font-medium">Notes</div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{expense.notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
                {attachments.length > 0 && <span className="text-xs text-slate-500">({attachments.length})</span>}
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading attachments...
              </div>
            ) : error ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
            ) : attachments.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-lg">
                No attachments for this expense.
              </div>
            ) : (
              <div className="space-y-5">
                {images.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" /> Images ({images.length})
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((a, idx) => (
                        <button
                          key={a.id}
                          onClick={() => setLightboxIndex(idx)}
                          className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-blue-500 transition"
                        >
                          <img
                            src={signed[a.file_path!]}
                            alt={a.file_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <div className="text-[11px] text-white truncate">{a.file_name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {otherFiles.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> Files ({otherFiles.length})
                    </div>
                    <div className="space-y-2">
                      {otherFiles.map(a => (
                        <a
                          key={a.id}
                          href={a.file_path ? signed[a.file_path] : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">{a.file_name}</div>
                              <div className="text-xs text-slate-500">{formatBytes(a.file_size)} {a.mime_type ? `• ${a.mime_type}` : ''}</div>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {links.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> Links ({links.length})
                    </div>
                    <div className="space-y-2">
                      {links.map(a => (
                        <a
                          key={a.id}
                          href={a.external_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                              <ExternalLink className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">{a.file_name}</div>
                              <div className="text-xs text-slate-500 truncate">{a.external_url}</div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition">
            Close
          </button>
          <button onClick={onDelete} className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button onClick={onEdit} className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
            <Edit className="w-4 h-4" /> Edit Expense
          </button>
        </div>
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg"
            aria-label="Close image"
          >
            <X className="w-6 h-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={signed[images[lightboxIndex].file_path!]}
              alt={images[lightboxIndex].file_name}
              className="max-h-[85vh] max-w-full object-contain"
            />
            <div className="text-white text-center mt-3 text-sm">
              {images[lightboxIndex].file_name} · {lightboxIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({
  icon, label, value, mono, capitalize,
}: { icon: React.ReactNode; label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500 mb-1">
        {icon}{label}
      </div>
      <div className={`text-sm text-slate-900 font-medium ${mono ? 'font-mono' : ''} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </div>
    </div>
  );
}
