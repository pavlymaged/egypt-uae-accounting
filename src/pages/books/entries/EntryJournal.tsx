import { BookOpenCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { trimZeros } from '../../../lib/decimal';
import { formatDate } from '../../../lib/dates';
import { formatNumber } from '../../../lib/money';
import type { Currency } from '../../../types';
import { sumText, type JournalLine } from './entries';

interface Props {
  lines: JournalLine[];
  cashName: Map<string, string>;
  baseCurrency: Currency;
}

export function EntryJournal({ lines, cashName, baseCurrency }: Props) {
  const { t } = useI18n();
  const journals = [false, true]
    .map((reversal) => lines.filter((l) => l.is_reversal === reversal).sort((a, b) => a.line_no - b.line_no))
    .filter((group) => group.length > 0);

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
        <BookOpenCheck className="h-4 w-4 text-brand-700" />
        <h3 className="text-sm font-semibold text-ink-900">{t('payments.journal.title')}</h3>
      </div>
      {journals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-500">{t('payments.journal.notPosted')}</p>
      ) : (
        <div className="divide-y divide-ink-200">
          {journals.map((group) => (
            <JournalTable key={group[0].journal_id} lines={group} cashName={cashName} baseCurrency={baseCurrency} />
          ))}
        </div>
      )}
    </Card>
  );
}

function JournalTable({ lines, cashName, baseCurrency }: Props) {
  const { t, lang } = useI18n();
  const first = lines[0];
  const debit = sumText(lines.filter((l) => l.side === 'debit').map((l) => l.base_amount));
  const credit = sumText(lines.filter((l) => l.side === 'credit').map((l) => l.base_amount));

  const accountLabel = (key: string) => {
    const [kind, ...rest] = key.split(':');
    const code = rest.join(':');
    if (kind === 'CASH') return t('payments.journal.cash', { name: cashName.get(code) ?? code });
    if (kind === 'FUND') return t('payments.journal.fund', { code });
    if (key === 'REV:MGMT_FEE') return t('payments.journal.feeRevenue');
    return key;
  };

  return (
    <div className="p-5">
      <p className="mb-3 text-sm font-medium text-ink-800">
        {first.is_reversal ? t('payments.journal.reversal') : t('payments.journal.original')}
        <span className="ms-2 font-normal text-ink-500">{formatDate(first.journal_date, lang)}</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-ink-200">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50/60 text-xs font-medium uppercase tracking-wide text-ink-500">
              <th className="px-3 py-2.5 text-start">{t('payments.journal.account')}</th>
              <th className="px-3 py-2.5 text-start">{t('payments.journal.side')}</th>
              <th className="px-3 py-2.5 text-end">{t('payments.field.amount')}</th>
              <th className="px-3 py-2.5 text-end">{t('payments.field.rate')}</th>
              <th className="px-3 py-2.5 text-end">{t('payments.journal.baseAmount', { currency: baseCurrency })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {lines.map((l) => (
              <tr key={l.line_no}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-ink-900">{accountLabel(l.account_key)}</p>
                  {l.memo && <p dir="auto" className="text-xs text-ink-500">{l.memo}</p>}
                </td>
                <td className="px-3 py-2.5 text-ink-700">{l.side === 'debit' ? t('payments.journal.debit') : t('payments.journal.credit')}</td>
                <td dir="ltr" className="px-3 py-2.5 text-end tabular-nums text-ink-900 rtl:text-start">{`${formatNumber(l.amount, l.currency)} ${l.currency}`}</td>
                <td dir="ltr" className="px-3 py-2.5 text-end tabular-nums text-ink-600 rtl:text-start">{trimZeros(l.rate)}</td>
                <td dir="ltr" className="px-3 py-2.5 text-end tabular-nums text-ink-900 rtl:text-start">{formatNumber(l.base_amount, baseCurrency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-200 bg-ink-50/60 text-sm">
              <td colSpan={5} className="px-3 py-2.5">
                <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 font-medium text-ink-800">
                  <span>{t('payments.journal.totalDebit')}: <span dir="ltr" className="tabular-nums">{debit === null ? '-' : `${formatNumber(debit, baseCurrency)} ${baseCurrency}`}</span></span>
                  <span>{t('payments.journal.totalCredit')}: <span dir="ltr" className="tabular-nums">{credit === null ? '-' : `${formatNumber(credit, baseCurrency)} ${baseCurrency}`}</span></span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
