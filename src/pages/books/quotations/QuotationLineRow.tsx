import { Copy, ExternalLink, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { inputClass } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import type { Currency } from '../../../types';
import { isNegativeText, money } from '../transfers/transfers';
import type { LineCheck, LineDraft } from './lineDrafts';

interface Props {
  index: number;
  line: LineDraft;
  currency: Currency;
  result: LineCheck | undefined;
  saveError: string | undefined;
  stale: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
  onCopy: () => void;
}

const cell = (label: string, child: ReactNode, className = '') => (
  <label className={`block min-w-0 ${className}`}>
    <span className="mb-1 block text-xs font-medium text-ink-500 lg:sr-only">{label}</span>
    {child}
  </label>
);

export function QuotationLineRow({ index, line, currency, result, saveError, stale, canRemove, onChange, onRemove, onCopy }: Props) {
  const { t } = useI18n();
  const error = saveError ?? result?.error ?? null;
  const numberInput = (field: 'qty' | 'office_unit' | 'client_unit', label: string) =>
    cell(
      label,
      <input
        inputMode="decimal"
        dir="ltr"
        value={line[field]}
        onChange={(e) => onChange({ [field]: e.target.value })}
        aria-invalid={!!error || undefined}
        className={`${inputClass(false)} text-end tabular-nums`}
      />,
    );

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 lg:rounded-none lg:border-0 lg:border-b lg:border-ink-100 lg:px-3 lg:py-3">
      <div className="mb-3 flex items-center justify-between lg:hidden">
        <span className="text-sm font-semibold text-ink-800">{t('quotations.lineN', { n: index + 1 })}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.4fr)_6rem_5rem_7rem_7rem_4.5rem] lg:items-start lg:gap-2">
        <span className="hidden pt-2.5 text-sm font-medium tabular-nums text-ink-500 lg:block">{index + 1}</span>
        {cell(
          t('quotations.field.description'),
          <input dir="auto" value={line.description} onChange={(e) => onChange({ description: e.target.value })} className={inputClass(false)} />,
          'col-span-2 lg:col-span-1',
        )}
        {cell(
          t('quotations.field.link'),
          <div className="relative">
            <input dir="ltr" type="url" placeholder="https://" value={line.link} onChange={(e) => onChange({ link: e.target.value })} className={`${inputClass(false)} pe-8`} />
            {/^https?:\/\//i.test(line.link.trim()) && (
              <a href={line.link.trim()} target="_blank" rel="noopener noreferrer" aria-label={t('quotations.openLink')} className="absolute end-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand-700">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>,
          'col-span-2 lg:col-span-1',
        )}
        {numberInput('qty', t('quotations.field.qty'))}
        {cell(t('quotations.field.unit'), <input dir="auto" value={line.unit} onChange={(e) => onChange({ unit: e.target.value })} className={inputClass(false)} />)}
        {numberInput('office_unit', t('quotations.field.officeUnit'))}
        {numberInput('client_unit', t('quotations.field.clientUnit'))}
        <div className="col-span-2 flex items-center justify-end gap-1 lg:col-span-1 lg:pt-1">
          <button type="button" onClick={onCopy} title={t('quotations.copyLine')} aria-label={t('quotations.copyLine')} className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800">
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            title={t('quotations.removeLine')}
            aria-label={t('quotations.removeLine')}
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={`mt-2 space-y-2 lg:ps-10 ${stale ? 'opacity-60' : ''}`} aria-live="polite">
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          result && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-ink-600">
              <span>{t('quotations.officeTotal')}: <span dir="ltr">{money(result.office_total, currency)}</span></span>
              <span>{t('quotations.clientTotal')}: <span dir="ltr">{money(result.client_total, currency)}</span></span>
              <span className={`font-medium ${isNegativeText(result.commission) ? 'text-red-700' : 'text-emerald-700'}`}>{t('quotations.commission')}: <span dir="ltr">{money(result.commission, currency)}</span></span>
            </p>
          )
        )}
        {result?.client_below_office && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={line.confirm} onChange={(e) => onChange({ confirm: e.target.checked })} />
            {t('quotations.confirmBelow')}
          </label>
        )}
      </div>
    </li>
  );
}
