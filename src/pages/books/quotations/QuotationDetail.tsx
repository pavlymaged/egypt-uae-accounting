import { AlertTriangle, ArrowLeft, ExternalLink, FileText, MessageSquare } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate, formatDateTime } from '../../../lib/dates';
import { toUnits } from '../../../lib/decimal';
import { supabase } from '../../../lib/supabase';
import { money } from '../transfers/transfers';
import { QuotationActions } from './QuotationActions';
import { QuotationStateBadges, RevisionStatusBadge, TotalsTriple } from './QuotationParts';
import { LINE_COLUMNS, REVISION_COLUMNS, sumText, type Quotation, type QuotationLine, type Revision } from './quotations';

interface Props {
  quotation: Quotation;
  onBack: () => void;
  onEdit: () => void;
  onDone: (text: string, openEditor?: boolean) => void;
}

const isBelowOffice = (l: QuotationLine) => {
  const client = toUnits(l.client_unit, 8);
  const office = toUnits(l.office_unit, 8);
  return client !== null && office !== null && client < office;
};

const safeLink = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

export function QuotationDetail({ quotation: q, onBack, onEdit, onDone }: Props) {
  const { t, lang } = useI18n();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string>(q.approved_revision_id ?? q.latest_revision_id);
  const [lines, setLines] = useState<QuotationLine[] | null>(null);
  const [linesFailed, setLinesFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    supabase
      .from('quotation_revisions')
      .select(REVISION_COLUMNS)
      .eq('quotation_id', q.quotation_id)
      .order('revision', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setRevisions(data as unknown as Revision[]);
      });
    return () => {
      cancelled = true;
    };
  }, [q.quotation_id, q.latest_revision_id, q.latest_status, attempt]);

  useEffect(() => {
    let cancelled = false;
    setLines(null);
    setLinesFailed(false);
    supabase
      .from('quotation_lines_list')
      .select(LINE_COLUMNS)
      .eq('revision_id', selected)
      .order('line_no')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setLinesFailed(true);
        setLines(data as unknown as QuotationLine[]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, q.latest_status, attempt]);

  const current = revisions?.find((r) => r.id === selected);
  const approvedShown = q.state === 'approved';

  return (
    <div className="space-y-4">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />} onClick={onBack}>{t('quotations.backToList')}</Button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink-900">{q.reference}</h2>
              <QuotationStateBadges quotation={q} />
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t('quotations.field.vendor')} value={<><span dir="ltr" className="font-mono text-ink-600">{q.vendor_code}</span> <span dir="auto">{q.vendor_name}</span></>} />
              <Info label={t('quotations.field.project')} value={<><span dir="ltr" className="font-mono text-ink-600">{q.project_code}</span> <span dir="auto">{q.project_name}</span></>} />
              <Info label={t('quotations.field.date')} value={formatDate(q.quotation_date, lang)} />
              <Info label={t('quotations.field.currency')} value={<span dir="ltr">{q.currency}</span>} />
            </dl>
            {q.notes && <p dir="auto" className="mt-3 whitespace-pre-wrap text-sm text-ink-600">{q.notes}</p>}
            {q.cancel_reason && (
              <p dir="auto" className="mt-3 text-sm text-ink-600"><span className="font-medium text-ink-800">{t('quotations.cancelledBecause')}</span> {q.cancel_reason}</p>
            )}
          </div>
        </div>
        <div className="mt-5 border-t border-ink-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
            {approvedShown ? t('quotations.approvedTotals', { n: q.approved_revision ?? '' }) : t('quotations.latestTotals', { n: q.latest_revision })}
          </p>
          <TotalsTriple
            currency={q.currency}
            client={approvedShown ? q.approved_client_total : q.latest_client_total}
            office={approvedShown ? q.approved_office_total : q.latest_office_total}
            commission={approvedShown ? q.approved_commission : null}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <QuotationActions quotation={q} onEdit={onEdit} onDone={onDone} />
        </div>
      </Card>

      {failed ? (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>{t('common.loadFailed')}</Alert>
      ) : !revisions ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="p-2">
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-500">{t('quotations.revisions')}</p>
            <ul className="space-y-1">
              {revisions.map((r) => {
                const active = r.id === selected;
                const approved = r.id === q.approved_revision_id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.id)}
                      aria-pressed={active}
                      className={`w-full rounded-lg px-3 py-2.5 text-start transition-colors ${active ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-ink-50'} ${approved ? 'border-s-4 border-emerald-500' : ''}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900">{t('quotations.revisionN', { n: r.revision })}</span>
                        <RevisionStatusBadge status={r.status} />
                      </span>
                      <span className="mt-1 block text-xs text-ink-500">
                        {r.submitted_at ? t('quotations.submittedOn', { date: formatDateTime(r.submitted_at, lang) }) : t('quotations.notSubmitted')}
                      </span>
                      {r.decided_at && <span className="block text-xs text-ink-500">{t('quotations.decidedOn', { date: formatDateTime(r.decided_at, lang) })}</span>}
                      {r.decision_comment && (
                        <span dir="auto" className="mt-1.5 flex gap-1.5 text-xs text-ink-700">
                          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                          <span className="line-clamp-3">{r.decision_comment}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink-900">{current ? t('quotations.linesOfRevision', { n: current.revision }) : t('quotations.lines')}</h3>
                {current?.id === q.approved_revision_id && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{t('quotations.approvedRevision')}</span>}
              </div>
              {current?.decision_comment && <p dir="auto" className="text-xs text-ink-600"><span className="font-medium">{t('quotations.ownerComment')}</span> {current.decision_comment}</p>}
            </div>
            {linesFailed ? (
              <div className="p-4"><Alert tone="error">{t('common.loadFailed')}</Alert></div>
            ) : !lines ? (
              <div className="p-6"><Spinner label={t('common.loading')} /></div>
            ) : lines.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">{t('quotations.noLines')}</p>
            ) : (
              <>
                <ul className="divide-y divide-ink-100">
                  {lines.map((l) => {
                    const below = isBelowOffice(l);
                    const href = safeLink(l.link);
                    return (
                      <li key={l.line_no} className={`px-4 py-3 ${below ? 'bg-amber-50/60' : ''}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p dir="auto" className="text-sm font-medium text-ink-900"><span className="me-2 text-ink-400 tabular-nums">{l.line_no}.</span>{l.description}</p>
                            <p className="mt-0.5 text-xs text-ink-500" dir="ltr">
                              {l.qty} {l.unit ?? ''} x {money(l.office_unit, q.currency)} / {money(l.client_unit, q.currency)}
                            </p>
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                                <ExternalLink className="h-3 w-3" /> {t('quotations.openLink')}
                              </a>
                            )}
                            {below && (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5" /> {t('quotations.belowOfficeMark')}
                              </p>
                            )}
                          </div>
                          <div className="w-full sm:w-80"><TotalsTriple compact currency={q.currency} client={l.client_total} office={l.office_total} commission={l.commission} /></div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-ink-200 bg-ink-50/60 px-4 py-3">
                  <TotalsTriple
                    currency={q.currency}
                    client={sumText(lines.map((l) => l.client_total))}
                    office={sumText(lines.map((l) => l.office_total))}
                    commission={sumText(lines.map((l) => l.commission))}
                  />
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="truncate font-medium text-ink-900">{value}</dd>
    </div>
  );
}
