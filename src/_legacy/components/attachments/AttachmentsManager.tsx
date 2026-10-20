import { useEffect, useRef, useState, DragEvent, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Paperclip, Upload, Link as LinkIcon, X, FileText, Image as ImageIcon, ExternalLink, Loader2, Download } from 'lucide-react';

export type AttachmentEntityType =
  | 'general_expense'
  | 'site_expense'
  | 'vendor_payment'
  | 'vendor'
  | 'employee_advance'
  | 'project_income'
  | 'item';

interface Attachment {
  id: string;
  organization_id: string;
  entity_type: AttachmentEntityType;
  entity_id: string;
  kind: 'file' | 'link';
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
  created_at: string;
}

interface Props {
  organizationId: string;
  entityType: AttachmentEntityType;
  entityId: string | null;
  disabled?: boolean;
}

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
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

export default function AttachmentsManager({ organizationId, entityType, entityId, disabled }: Props) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entityId) loadAttachments();
    else setAttachments([]);
  }, [entityId]);

  const loadAttachments = async () => {
    if (!entityId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('attachments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setAttachments(data || []);
    setLoading(false);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_BYTES) return `File "${file.name}" exceeds 10MB limit`;
    if (!ALLOWED_MIME.includes(file.type)) return `File type "${file.type || 'unknown'}" not allowed`;
    return null;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!entityId) {
      setError('Save the record first before adding attachments');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const list = Array.from(files);
      for (const file of list) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${entityType}/${entityId}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadErr) {
          setError(`Upload failed: ${uploadErr.message}`);
          continue;
        }
        const { error: insertErr } = await supabase.from('attachments').insert({
          organization_id: organizationId,
          entity_type: entityType,
          entity_id: entityId,
          kind: 'file',
          file_name: file.name,
          file_path: path,
          file_url: path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id,
        });
        if (insertErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          setError(`Save failed: ${insertErr.message}`);
        }
      }
      await loadAttachments();
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || !entityId) return;
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  };

  const addLink = async () => {
    if (!entityId) {
      setError('Save the record first before adding attachments');
      return;
    }
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      setError('Invalid URL');
      return;
    }
    setError(null);
    const { error: err } = await supabase.from('attachments').insert({
      organization_id: organizationId,
      entity_type: entityType,
      entity_id: entityId,
      kind: 'link',
      file_name: linkLabel.trim() || url,
      file_url: url,
      external_url: url,
      uploaded_by: user?.id,
    });
    if (err) setError(err.message);
    else {
      setLinkUrl('');
      setLinkLabel('');
      setShowLinkForm(false);
      await loadAttachments();
    }
  };

  const removeAttachment = async (att: Attachment) => {
    if (!confirm(`Remove "${att.file_name}"?`)) return;
    if (att.kind === 'file' && att.file_path) {
      await supabase.storage.from(BUCKET).remove([att.file_path]);
    }
    const { error: err } = await supabase.from('attachments').delete().eq('id', att.id);
    if (err) setError(err.message);
    else setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  const downloadFile = async (att: Attachment) => {
    if (!att.file_path) return;
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(att.file_path, 60);
    if (err || !data) {
      setError(err?.message || 'Could not generate download link');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  if (!entityId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <Paperclip className="inline w-4 h-4 mr-2" />
        Save the record to attach files or links.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Attachments {attachments.length > 0 && <span className="text-slate-500">({attachments.length})</span>}
        </label>
        <button
          type="button"
          onClick={() => setShowLinkForm((v) => !v)}
          disabled={disabled}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <LinkIcon className="w-3 h-3" />
          {showLinkForm ? 'Cancel link' : 'Add link'}
        </button>
      </div>

      {showLinkForm && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <input
            type="text"
            placeholder="Label (optional)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addLink}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
        } ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          disabled={disabled || uploading}
          className="hidden"
          accept={ALLOWED_MIME.join(',')}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </div>
        ) : (
          <>
            <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
            <p className="text-sm text-slate-600">
              <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500 mt-1">PDF, images, Word, Excel, CSV up to 10MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500">Loading attachments...</div>
      ) : attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {att.kind === 'link' ? (
                  <LinkIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                ) : isImage(att.mime_type) ? (
                  <ImageIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 truncate">{att.file_name}</div>
                  {att.kind === 'file' && (
                    <div className="text-xs text-slate-500">{formatBytes(att.file_size)}</div>
                  )}
                  {att.kind === 'link' && att.external_url && (
                    <div className="text-xs text-slate-500 truncate">{att.external_url}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {att.kind === 'link' && att.external_url ? (
                  <a
                    href={att.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => downloadFile(att)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(att)}
                  disabled={disabled}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-slate-500 text-center py-2">No attachments yet.</div>
      )}
    </div>
  );
}
