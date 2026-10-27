import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { useI18n } from '../../i18n/I18nProvider';
import { fromUnits, sumUnits, toUnits } from '../../lib/decimal';
import { currencyDecimals, formatNumber } from '../../lib/money';
import type { Currency } from '../../types';

export interface MilestoneRow {
  key: string;
  percent: string;
  amount: string;
}

interface Props {
  rows: MilestoneRow[];
  onChange: (rows: MilestoneRow[]) => void;
  total: string;
  currency: Currency;
  error: string | null;
}

export function newRow(percent = '', amount = ''): MilestoneRow {
  return { key: crypto.randomUUID(), percent, amount };
}

export function MilestonesEditor({ rows, onChange, total, currency, error }: Props) {
  const { t } = useI18n();
  const scale = currencyDecimals(currency);
  const totalUnits = toUnits(total, scale);
  const amounts = rows.map((r) => (r.amount.trim() ? toUnits(r.amount, scale) : null));
  const allocated = sumUnits(amounts.filter((a): a is bigint => a !== null));
  const remaining = totalUnits === null ? null : totalUnits - allocated;
  const unreadable = rows.some((r, i) => r.amount.trim() !== '' && amounts[i] === null);

  const update = (key: string, patch: Partial<MilestoneRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-ink-200">
        <div className="grid grid-cols-[2.5rem_1fr_1.4fr_2.75rem] items-center gap-2 bg-ink-50/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">
          <span>#</span>
          <span>{t('projects.ms.percent')}</span>
          <span>{t('projects.ms.amount', { currency })}</span>
          <span />
        </div>
        <ul className="divide-y divide-ink-100">
          {rows.map((row, i) => (
            <li key={row.key} className="grid grid-cols-[2.5rem_1fr_1.4fr_2.75rem] items-center gap-2 px-3 py-2">
              <span className="text-sm tabular-nums text-ink-500">{i + 1}</span>
              <div className="relative">
                <TextInput
                  dir="ltr"
                  inputMode="decimal"
                  aria-label={`${t('projects.ms.percent')} ${i + 1}`}
                  value={row.percent}
                  onChange={(e) => update(row.key, { percent: e.target.value })}
                  className="pe-7 tabular-nums"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">%</span>
              </div>
              <TextInput
                dir="ltr"
                inputMode="decimal"
                aria-label={`${t('projects.ms.amount', { currency })} ${i + 1}`}
                invalid={amounts[i] === null && row.amount.trim() !== ''}
                value={row.amount}
                onChange={(e) => update(row.key, { amount: e.target.value })}
                className="tabular-nums"
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                disabled={rows.length === 1}
                aria-label={t('projects.ms.remove', { n: i + 1 })}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...rows, newRow()])}>
          {t('projects.ms.add')}
        </Button>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-500">{t('projects.ms.total')}</dt>
          <dd dir="ltr" className="text-end font-medium tabular-nums text-ink-900">{formatNumber(fromUnits(allocated, scale), currency)} {currency}</dd>
          <dt className="text-ink-500">{t('projects.ms.remaining')}</dt>
          <dd dir="ltr" className={`text-end font-medium tabular-nums ${remaining === null ? 'text-ink-400' : remaining === BigInt(0) ? 'text-emerald-700' : 'text-amber-700'}`}>
            {remaining === null ? '-' : `${formatNumber(fromUnits(remaining, scale), currency)} ${currency}`}
          </dd>
        </dl>
      </div>

      {unreadable && <p className="text-xs font-medium text-amber-700">{t('projects.ms.badAmount', { n: scale })}</p>}
      {error ? <p role="alert" className="text-xs font-medium text-red-700">{error}</p> : <p className="text-xs text-ink-500">{t('projects.ms.hint')}</p>}
    </div>
  );
}
