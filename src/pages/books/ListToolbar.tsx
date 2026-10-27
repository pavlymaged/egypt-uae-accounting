import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { TextInput } from '../../components/ui/Field';

export function ListToolbar({ query, onQuery, placeholder, children }: { query: string; onQuery: (q: string) => void; placeholder: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <TextInput value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="ps-9" />
      </div>
      {children && <div className="flex flex-wrap items-center gap-4">{children}</div>}
    </div>
  );
}
