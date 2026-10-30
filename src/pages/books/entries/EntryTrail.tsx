import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDateTime } from '../../../lib/dates';
import { supabase } from '../../../lib/supabase';
import type { BooksAccess, CashAccount } from '../books';
import { JOURNAL_COLUMNS, type EntryWorkflow, type JournalLine } from './entries';
import { EntryJournal } from './EntryJournal';

interface Loaded {
  lines: JournalLine[];
  names: Map<string, string>;
  rejectedBy: string | null;
  reversedBy: string | null;
}

export async function loadPeopleNames(companyId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const [staff, members] = await Promise.all([
    supabase.from('staff_members').select('user_id, full_name').in('user_id', unique),
    supabase.from('company_users').select('user_id, full_name').eq('company_id', companyId).in('user_id', unique),
  ]);
  for (const r of [...(members.data ?? []), ...(staff.data ?? [])] as { user_id: string; full_name: string }[]) names.set(r.user_id, r.full_name);
  return names;
}

/** Loads the journal and the names behind an entry's workflow steps. */
export function useEntryTrail(entry: EntryWorkflow, companyId: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      const [journal, row] = await Promise.all([
        supabase.from('entry_journal_lines').select(JOURNAL_COLUMNS).eq('entry_id', entry.entry_id).order('is_reversal').order('line_no'),
        supabase.from('entries').select('rejected_by, reversed_by').eq('id', entry.entry_id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (journal.error || !Array.isArray(journal.data)) return setFailed(true);
      const rejectedBy = (row.data?.rejected_by as string | null) ?? null;
      const reversedBy = (row.data?.reversed_by as string | null) ?? null;
      const names = await loadPeopleNames(companyId, [entry.created_by, entry.submitted_by, entry.posted_by, rejectedBy, reversedBy]);
      if (cancelled) return;
      setLoaded({ lines: journal.data as unknown as JournalLine[], names, rejectedBy, reversedBy });
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.entry_id, entry.status, entry.created_by, entry.submitted_by, entry.posted_by, companyId, attempt]);

  return { loaded, failed, retry: () => setAttempt((a) => a + 1) };
}

type Trail = ReturnType<typeof useEntryTrail>;

export function EntryTimeline({ entry: e, trail }: { entry: EntryWorkflow; trail: Trail }) {
  const { t, lang } = useI18n();
  const who = (id: string | null) => (id && trail.loaded?.names.get(id)) || '-';
  const events: { key: string; label: string; at: string | null; by: string | null; note?: string | null; tone: string }[] = [
    { key: 'recorded', label: t('payments.timeline.recorded'), at: e.created_at, by: e.created_by, tone: 'bg-ink-400' },
  ];
  if (e.submitted_at) events.push({ key: 'submitted', label: t('payments.timeline.submitted'), at: e.submitted_at, by: e.submitted_by, tone: 'bg-sky-500' });
  if (e.rejected_at) events.push({ key: 'returned', label: t('payments.timeline.returned'), at: e.rejected_at, by: trail.loaded?.rejectedBy ?? null, note: e.reject_comment, tone: 'bg-amber-500' });
  if (e.posted_at) events.push({ key: 'posted', label: t('payments.timeline.posted'), at: e.posted_at, by: e.posted_by, tone: 'bg-emerald-500' });
  if (e.reversed_at) events.push({ key: 'reversed', label: t('payments.timeline.reversed'), at: e.reversed_at, by: trail.loaded?.reversedBy ?? null, note: e.reversal_reason, tone: 'bg-red-500' });

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-4 text-sm font-semibold text-ink-900">{t('payments.timeline.title')}</h3>
      <ol className="relative space-y-5 border-s border-ink-200 ps-5">
        {events.map((ev) => (
          <li key={ev.key} className="relative">
            <span className={`absolute -start-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${ev.tone}`} />
            <p className="text-sm font-medium text-ink-900">{ev.label}</p>
            <p className="text-xs text-ink-500">{formatDateTime(ev.at, lang)} · {who(ev.by)}</p>
            {ev.note && <p dir="auto" className="mt-1 rounded-md bg-ink-50 px-2.5 py-1.5 text-sm text-ink-700">{ev.note}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function EntryJournalSection({ trail, access, accounts, itemName }: { trail: Trail; access: BooksAccess; accounts: CashAccount[]; itemName?: Map<string, string> }) {
  const { t } = useI18n();
  const cashName = useMemo(() => new Map(accounts.map((a) => [a.code, a.name])), [accounts]);
  if (trail.failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={trail.retry}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!trail.loaded) return <Spinner label={t('common.loading')} />;
  return <EntryJournal lines={trail.loaded.lines} cashName={cashName} itemName={itemName} baseCurrency={access.currency} />;
}
