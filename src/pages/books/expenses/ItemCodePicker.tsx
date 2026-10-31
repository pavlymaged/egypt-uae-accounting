import { ChevronDown, Search } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { inputClass } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import type { ItemCode } from './expenses';

interface Props {
  value: string;
  items: ItemCode[];
  invalid?: boolean;
  onChange: (code: string) => void;
  'aria-label'?: string;
}

const LIMIT = 60;

const fold = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').toLowerCase().trim();

export function ItemCodePicker({ value, items, invalid = false, onChange, 'aria-label': label }: Props) {
  const { t, lang } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = items.find((i) => String(i.code) === value) ?? null;

  const matches = useMemo(() => {
    const q = fold(query);
    const hits = q ? items.filter((i) => fold(i.code).startsWith(q) || fold(i.name_en).includes(q) || fold(i.name_ar).includes(q)) : items;
    return hits.slice(0, LIMIT);
  }, [items, query]);

  const shown = selected ? `${selected.code} · ${(lang === 'ar' && selected.name_ar) || selected.name_en}` : value;

  function pick(item: ItemCode) {
    onChange(String(item.code));
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={`${inputClass(invalid)} ps-8 pe-8`}
        placeholder={t('expenses.itemSearch')}
        value={open ? query : shown}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActive(0);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full min-w-[18rem] overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-500">{t('books.noMatch')}</li>
          ) : (
            matches.map((item, index) => (
              <li
                key={item.code}
                role="option"
                aria-selected={String(item.code) === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm ${index === active ? 'bg-brand-50' : ''}`}
              >
                <span dir="ltr" className="w-12 shrink-0 font-mono text-xs font-semibold text-brand-700">{item.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink-900">{item.name_en}</span>
                  {item.name_ar && <span dir="rtl" className="block truncate text-xs text-ink-500">{item.name_ar}</span>}
                </span>
                {item.scope === 'office' && <span className="shrink-0 rounded bg-gold-50 px-1.5 text-[11px] font-medium text-gold-800">{t('expenses.officeCode')}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
