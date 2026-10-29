import { useI18n } from '../../../i18n/I18nProvider';
import { ENTRY_STATUSES, STATUS_LABEL, type EntryStatus } from './entries';

export type StatusFilter = EntryStatus | 'all';

export function statusCounts(rows: { status: EntryStatus }[]): Map<StatusFilter, number> {
  const result = new Map<StatusFilter, number>([['all', rows.length]]);
  rows.forEach((r) => result.set(r.status, (result.get(r.status) ?? 0) + 1));
  return result;
}

export function EntryStatusChips({ value, counts, onChange }: { value: StatusFilter; counts: Map<StatusFilter, number>; onChange: (s: StatusFilter) => void }) {
  const { t } = useI18n();
  const chips: StatusFilter[] = ['all', ...ENTRY_STATUSES];
  return (
    <div role="tablist" aria-label={t('books.col.status')} className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const selected = value === chip;
        return (
          <button
            key={chip}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(chip)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
            }`}
          >
            {chip === 'all' ? t('books.filter.all') : t(STATUS_LABEL[chip])}
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'}`}>{counts.get(chip) ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ReturnNote({ comment }: { comment: string }) {
  const { t } = useI18n();
  return (
    <div className="px-4 pb-4">
      <div className="rounded-lg border-s-4 border-amber-500 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        <span className="font-semibold">{t('payments.returnComment')}: </span>
        <span dir="auto">{comment}</span>
      </div>
    </div>
  );
}
