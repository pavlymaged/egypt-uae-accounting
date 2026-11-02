import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert, Card, Spinner } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate, formatDateTime } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import type { Currency } from '../../types';
import { EntryJournal } from '../books/entries/EntryJournal';
import { JOURNAL_COLUMNS, type JournalLine } from '../books/entries/entries';
import { ClaimActions, hasClaimActions } from './ClaimActions';
import { claimItemLabel, type SiteClaim } from './claims';
import { ClaimStateBadge, Money, OfficeComment, ReceiptLink } from './ClaimParts';

interface Props {
  claim: SiteClaim;
  currency: Currency;
  cashName: Map<string, string>;
  custodyName: Map<string, string>;
  onBack: () => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="min-w-0 text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export function ClaimDetail({ claim: c, currency, cashName, custodyName, onBack, onDone, onError }: Props) {
  const { t, lang } = useI18n();
  const events: { key: string; label: string; at: string; note?: string | null; tone: string }[] = [
    { key: 'submitted', label: t('claims.timeline.submitted'), at: c.created_at, tone: 'bg-sky-500' },
  ];
  if (c.pre_approved_at) events.push({ key: 'pre', label: t('claims.timeline.preapproved'), at: c.pre_approved_at, tone: 'bg-gold-500' });
  if (c.rejected_at) events.push({ key: 'returned', label: t('claims.timeline.returned'), at: c.rejected_at, note: c.reject_comment, tone: 'bg-amber-500' });
  if (c.approved_at) events.push({ key: 'approved', label: t('claims.timeline.approved'), at: c.approved_at, tone: 'bg-emerald-500' });
  events.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-4">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />} onClick={onBack}>
        {t('claims.back')}
      </Button>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-ink-900">{t('claims.details')}</h2>
            <ClaimStateBadge state={c.state} />
          </div>
          <Money value={c.amount} currency={currency} className="text-2xl font-semibold text-ink-900" />
        </div>
        {c.state === 'rejected' && c.reject_comment && (
          <div className="mt-4">
            <OfficeComment comment={c.reject_comment} />
          </div>
        )}
        <dl className="mt-4 divide-y divide-ink-100">
          <Row label={t('claims.engineer')}>{c.engineer_name ?? '-'}</Row>
          <Row label={t('claims.field.date')}>{formatDate(c.claim_date, lang)}</Row>
          <Row label={t('claims.field.project')}>
            <span dir="ltr" className="font-mono text-xs text-ink-500">{c.project_code ?? ''}</span> {c.project_name ?? '-'}
          </Row>
          <Row label={t('claims.field.category')}>{[c.category, c.category_name].filter(Boolean).join(' · ') || '-'}</Row>
          <Row label={t('claims.field.item')}>{claimItemLabel(c, lang) || '-'}</Row>
          <Row label={t('claims.field.description')}>
            <span dir="auto" className="whitespace-pre-line">{c.description || '-'}</span>
          </Row>
          <Row label={t('claims.receipt')}>{c.receipt_link ? <ReceiptLink link={c.receipt_link} /> : '-'}</Row>
        </dl>
        {hasClaimActions(c) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            <ClaimActions claim={c} onDone={onDone} onError={onError} />
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('claims.timeline.title')}</h3>
        <ol className="relative space-y-5 border-s border-ink-200 ps-5">
          {events.map((ev) => (
            <li key={ev.key} className="relative">
              <span className={`absolute -start-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${ev.tone}`} />
              <p className="text-sm font-medium text-ink-900">{ev.label}</p>
              <p className="text-xs text-ink-500">{formatDateTime(ev.at, lang)}</p>
              {ev.note && <p dir="auto" className="mt-1 rounded-md bg-ink-50 px-2.5 py-1.5 text-sm text-ink-700">{ev.note}</p>}
            </li>
          ))}
        </ol>
      </Card>

      {c.entry_id && (c.state === 'approved' || c.state === 'reversed') ? (
        <ClaimJournal entryId={c.entry_id} currency={currency} cashName={cashName} custodyName={custodyName} />
      ) : (
        <p className="text-sm text-ink-500">{t('claims.journal.pending')}</p>
      )}
    </div>
  );
}

function ClaimJournal({ entryId, currency, cashName, custodyName }: { entryId: string; currency: Currency; cashName: Map<string, string>; custodyName: Map<string, string> }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<JournalLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('entry_journal_lines')
      .select(JOURNAL_COLUMNS)
      .eq('entry_id', entryId)
      .order('is_reversal')
      .order('line_no')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setLines(data as unknown as JournalLine[]);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId, attempt]);

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!lines) return <Spinner label={t('common.loading')} />;
  return <EntryJournal lines={lines} cashName={cashName} custodyName={custodyName} baseCurrency={currency} />;
}
