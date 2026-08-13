import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut,
  FileText, Image as ImageIcon, Play, ExternalLink, Loader2
} from 'lucide-react';

export interface Attachment {
  id: string;
  kind: 'file' | 'link';
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
}

interface FileViewerProps {
  attachments: Attachment[];
  startIndex?: number;
  onClose: () => void;
  title?: string;
}

type FileType = 'image' | 'pdf' | 'video' | 'audio' | 'link' | 'other';

function getFileType(att: Attachment): FileType {
  if (att.kind === 'link') return 'link';
  const mime = att.mime_type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = att.file_name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  return 'other';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileViewer({ attachments, startIndex = 0, onClose, title }: FileViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const current = attachments[currentIndex];
  const fileType = current ? getFileType(current) : 'other';

  useEffect(() => {
    if (currentIndex >= attachments.length) {
      setCurrentIndex(0);
    }
  }, [attachments.length]);

  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  useEffect(() => {
    let cancelled = false;
    const loadFile = async () => {
      if (!current) return;
      setLoading(true);
      setError(null);
      setSignedUrl(null);

      if (current.kind === 'link') {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!current.file_path) {
        if (!cancelled) { setError('No file path available'); setLoading(false); }
        return;
      }
      try {
        const { data, error: urlError } = await supabase.storage
          .from('attachments')
          .createSignedUrl(current.file_path, 3600);
        if (urlError) throw urlError;
        if (!cancelled) {
          setSignedUrl(data?.signedUrl || null);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load file');
          setLoading(false);
        }
      }
    };
    loadFile();
    return () => { cancelled = true; };
  }, [current]);

  if (attachments.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-slate-600 mb-4">No attachments to view</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition">Close</button>
        </div>
      </div>
    );
  }

  const goPrev = () => setCurrentIndex(i => (i - 1 + attachments.length) % attachments.length);
  const goNext = () => setCurrentIndex(i => (i + 1) % attachments.length);

  const handleDownload = async () => {
    if (current.kind === 'link' && current.external_url) {
      window.open(current.external_url, '_blank');
      return;
    }
    if (signedUrl) {
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = current.file_name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/90" onClick={onClose}>
      {/* Main viewer area */}
      <div className="flex-1 flex flex-col min-w-0" onClick={(e) => e.stopPropagation()}>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            {attachments.length > 1 && (
              <div className="flex items-center gap-1 text-slate-400 text-sm">
                <button onClick={goPrev} className="p-1.5 hover:bg-slate-700 rounded-lg transition" disabled={attachments.length <= 1}>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs tabular-nums">{currentIndex + 1} / {attachments.length}</span>
                <button onClick={goNext} className="p-1.5 hover:bg-slate-700 rounded-lg transition" disabled={attachments.length <= 1}>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
            <p className="text-sm text-white truncate">{current?.file_name}</p>
            {current?.file_size && <span className="text-xs text-slate-500 hidden sm:inline">{formatSize(current.file_size)}</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {fileType === 'image' && signedUrl && (
              <>
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition" title="Zoom out">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-400 tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition" title="Zoom in">
                  <ZoomIn className="w-5 h-5" />
                </button>
              </>
            )}
            <button onClick={handleDownload} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition" title="Download">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 relative">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Loading file...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-red-400">
              <FileText className="w-12 h-12" />
              <p className="text-sm">{error}</p>
            </div>
          ) : fileType === 'image' && signedUrl ? (
            <img
              src={signedUrl}
              alt={current.file_name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          ) : fileType === 'pdf' && signedUrl ? (
            <iframe
              src={signedUrl}
              title={current.file_name}
              className="w-full h-full bg-white rounded-lg"
              style={{ minHeight: '70vh' }}
            />
          ) : fileType === 'video' && signedUrl ? (
            <video
              src={signedUrl}
              controls
              className="max-w-full max-h-full rounded-lg"
            />
          ) : fileType === 'audio' && signedUrl ? (
            <div className="flex flex-col items-center gap-4 bg-slate-800/50 rounded-xl p-8">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-slate-300">{current.file_name}</p>
              <audio src={signedUrl} controls className="w-full max-w-md" />
            </div>
          ) : fileType === 'link' ? (
            <div className="flex flex-col items-center gap-4 bg-slate-800/50 rounded-xl p-8">
              <ExternalLink className="w-12 h-12 text-blue-400" />
              <p className="text-sm text-slate-300">{current.file_name}</p>
              <a
                href={current.external_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open Link
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <FileText className="w-16 h-16" />
              <p className="text-sm">This file type cannot be previewed inline</p>
              <button onClick={handleDownload} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
                <Download className="w-4 h-4" /> Download File
              </button>
            </div>
          )}

          {/* Navigation arrows for multi-file */}
          {attachments.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white transition opacity-80 hover:opacity-100"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white transition opacity-80 hover:opacity-100"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thumbnail sidebar (when more than 1 attachment) */}
      {attachments.length > 1 && (
        <div className="w-44 bg-slate-900/90 border-l border-slate-800 overflow-y-auto hidden md:block">
          <div className="p-2 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase px-2 py-1">{title || 'Attachments'}</p>
            {attachments.map((att, idx) => {
              const ft = getFileType(att);
              const isActive = idx === currentIndex;
              return (
                <button
                  key={att.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition ${
                    isActive ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                    ft === 'image' ? 'bg-green-500/20' :
                    ft === 'pdf' ? 'bg-red-500/20' :
                    ft === 'video' ? 'bg-purple-500/20' :
                    ft === 'audio' ? 'bg-amber-500/20' :
                    ft === 'link' ? 'bg-blue-500/20' :
                    'bg-slate-700'
                  }`}>
                    {ft === 'image' ? <ImageIcon className="w-4 h-4 text-green-400" /> :
                     ft === 'pdf' ? <FileText className="w-4 h-4 text-red-400" /> :
                     ft === 'video' ? <Play className="w-4 h-4 text-purple-400" /> :
                     ft === 'audio' ? <Play className="w-4 h-4 text-amber-400" /> :
                     ft === 'link' ? <ExternalLink className="w-4 h-4 text-blue-400" /> :
                     <FileText className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>{att.file_name}</p>
                    <p className="text-[10px] text-slate-600">{formatSize(att.file_size)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
