import { X } from 'lucide-react';
import { useEffect } from 'react';
import { Badge } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime } from '../../lib/dates';
import { actionLabel, changesOf, entityLabel, fieldLabel, formatValue, recordName, type AuditEntry } from './auditFormat';

export const ACTION_TONE: Record<string, 'success' | 'sky' | 'danger' | 'neutral'> = {
  insert: 'success',
  update: 'sky',
  delete: 'danger',
};

export function AuditDetailPanel({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const { t, lang } = useI18n();

  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry, onClose]);

  if (!entry) return null;
  const changes = changesOf(entry);
  const name = recordName(entry);
  const showBefore = entry.action !== 'insert';
  const showAfter = entry.action !== 'delete';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label={t('common.close')} onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink-950/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl ltr:animate-slide-in-right rtl:animate-slide-in-left"
      >
        <header className="flex items-start gap-3 border-b border-ink-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ACTION_TONE[entry.action] ?? 'neutral'}>{actionLabel(entry.action, t)}</Badge>
              <span className="text-sm text-ink-500">{entityLabel(entry.entity_type, t)}</span>
            </div>
            <h2 id="audit-detail-title" className="mt-1.5 truncate text-lg font-semibold text-ink-900">
              {name ?? entry.entity_id ?? t('audit.entry', { n: entry.id })}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ink-500">{t('audit.col.when')}</dt>
              <dd className="mt-0.5 text-ink-900">{formatDateTime(entry.occurred_at, lang)}</dd>
            </div>
            <div>
              <dt className="text-ink-500">{t('audit.col.who')}</dt>
              <dd className="mt-0.5 text-ink-900">{entry.actor_name ?? t('audit.system')}</dd>
            </div>
            <div>
              <dt className="text-ink-500">{t('audit.col.company')}</dt>
              <dd className="mt-0.5 text-ink-900">{entry.company_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">{t('audit.entryNo')}</dt>
              <dd dir="ltr" className="mt-0.5 font-mono text-ink-900 rtl:text-end">#{entry.id}</dd>
            </div>
          </dl>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-900">{t('audit.changes')}</h3>
            {changes.length === 0 ? (
              <p className="text-sm text-ink-500">{t('audit.noChanges')}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-ink-200">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-3 py-2 text-start">{t('audit.field')}</th>
                      {showBefore && <th className="px-3 py-2 text-start">{t('audit.before')}</th>}
                      {showAfter && <th className="px-3 py-2 text-start">{t('audit.after')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {changes.map((c) => (
                      <tr key={c.field} className="align-top">
                        <td className="px-3 py-2.5 font-medium text-ink-800">{fieldLabel(c.field, t)}</td>
                        {showBefore && (
                          <td className="break-words px-3 py-2.5 text-ink-500">
                            {formatValue(c.field, c.before, entry.details?.old, t)}
                          </td>
                        )}
                        {showAfter && (
                          <td className="break-words px-3 py-2.5 text-ink-900">
                            {formatValue(c.field, c.after, entry.details?.new, t)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
