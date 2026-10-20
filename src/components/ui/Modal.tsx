import { X } from 'lucide-react';
import { useEffect, useId, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  submitLabel: string;
  submitTone?: 'primary' | 'danger';
  busy?: boolean;
  wide?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function Modal({ open, title, description, children, submitLabel, submitTone = 'primary', busy, wide, onSubmit, onClose }: ModalProps) {
  const { t } = useI18n();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!busy) onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <form
        onSubmit={handleSubmit}
        noValidate
        className={`relative flex max-h-[92vh] w-full animate-fade-in flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink-900">{title}</h2>
            {description && <div className="mt-1 text-sm text-ink-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
            className="-me-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button type="submit" variant={submitTone} loading={busy}>{submitLabel}</Button>
        </div>
      </form>
    </div>
  );
}
