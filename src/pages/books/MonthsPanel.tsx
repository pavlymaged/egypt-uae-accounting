import { CalendarCheck, Lock, Unlock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Alert, Badge, Card, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Field, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { formatMonth, todayIn } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { dbErrorText, type BooksAccess } from './books';

interface MonthRow {
  month: string;
  is_closed: boolean;
  unfinished: number;
  finished: number;
}

type Notice = { tone: 'success' | 'error'; text: string };

export function MonthsPanel({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<MonthRow[] | null>(null);
  const [currentMonth, setCurrentMonth] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [closing, setClosing] = useState<string | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase.from('month_overview').select('month, is_closed, unfinished, finished').eq('company_id', access.companyId).order('month', { ascending: false }),
      supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([months, company]) => {
      if (cancelled) return;
      if (months.error || company.error || !Array.isArray(months.data)) return setFailed(true);
      setCurrentMonth(`${todayIn(company.data?.time_zone ?? null).slice(0, 7)}-01`);
      setRows(
        (months.data as { month: string; is_closed: boolean; unfinished: number | string; finished: number | string }[]).map((m) => ({
          month: m.month.slice(0, 10),
          is_closed: m.is_closed,
          unfinished: Number(m.unfinished),
          finished: Number(m.finished),
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  const months = useMemo(() => {
    if (!rows) return [];
    const list = rows.some((r) => r.month === currentMonth) ? [...rows] : [{ month: currentMonth, is_closed: false, unfinished: 0, finished: 0 }, ...rows];
    return list.sort((a, b) => (a.month === currentMonth ? -1 : b.month === currentMonth ? 1 : b.month.localeCompare(a.month)));
  }, [rows, currentMonth]);

  async function closeMonth() {
    if (!closing) return;
    setBusy(true);
    const { error } = await supabase.rpc('close_month', { p_company: access.companyId, p_month: closing });
    setBusy(false);
    setNotice(error ? { tone: 'error', text: dbErrorText(error, t) } : { tone: 'success', text: t('months.closed', { month: formatMonth(closing, lang) }) });
    setClosing(null);
    setAttempt((a) => a + 1);
  }

  async function reopenMonth() {
    if (!reopening) return;
    setBusy(true);
    setDialogError(null);
    const { error } = await supabase.rpc('reopen_month', { p_company: access.companyId, p_month: reopening, p_reason: reason.trim() });
    setBusy(false);
    if (error) return setDialogError(dbErrorText(error, t));
    setNotice({ tone: 'success', text: t('months.reopened', { month: formatMonth(reopening, lang) }) });
    setReopening(null);
    setAttempt((a) => a + 1);
  }

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!rows) return <Spinner label={t('common.loading')} />;

  const statusNote = (m: MonthRow) => {
    if (m.is_closed) return null;
    if (m.month === currentMonth) return t('months.currentCannotClose');
    if (m.month > currentMonth) return t('months.futureCannotClose');
    if (m.unfinished > 0) return t('months.stillUnfinished', { count: m.unfinished });
    return null;
  };

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{t('months.intro')}</p>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <Card>
        {months.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title={t('months.empty')} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {months.map((m) => {
              const note = statusNote(m);
              const canClose = access.canCloseMonth && !m.is_closed && m.month < currentMonth && m.unfinished === 0;
              const canReopen = access.canReopenMonth && m.is_closed;
              return (
                <li key={m.month} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${m.month === currentMonth ? 'bg-brand-50/40' : ''}`}>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-900">{formatMonth(m.month, lang)}</p>
                      {m.is_closed ? (
                        <Badge tone="neutral"><Lock className="me-1 inline h-3 w-3" />{t('months.status.closed')}</Badge>
                      ) : (
                        <Badge tone="success">{t('months.status.open')}</Badge>
                      )}
                      {m.month === currentMonth && <Badge tone="brand">{t('months.current')}</Badge>}
                    </div>
                    <p className="text-sm text-ink-600">
                      <span>{t('months.unfinished')}: <span className="tabular-nums font-medium text-ink-800">{m.unfinished}</span></span>
                      <span className="mx-2 text-ink-300">·</span>
                      <span>{t('months.finished')}: <span className="tabular-nums font-medium text-ink-800">{m.finished}</span></span>
                    </p>
                    {note && <p className={`text-xs ${m.unfinished > 0 && m.month < currentMonth ? 'text-amber-800' : 'text-ink-500'}`}>{note}</p>}
                  </div>
                  <div className="flex gap-2">
                    {canClose && (
                      <Button variant="secondary" icon={<Lock className="h-4 w-4" />} onClick={() => setClosing(m.month)}>{t('months.close')}</Button>
                    )}
                    {canReopen && (
                      <Button
                        variant="secondary"
                        icon={<Unlock className="h-4 w-4" />}
                        onClick={() => {
                          setReason('');
                          setDialogError(null);
                          setReopening(m.month);
                        }}
                      >
                        {t('months.reopen')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!closing}
        title={t('months.closeTitle', { month: closing ? formatMonth(closing, lang) : '' })}
        confirmLabel={t('months.close')}
        loading={busy}
        onConfirm={closeMonth}
        onCancel={() => setClosing(null)}
      >
        {t('months.closeBody')}
      </ConfirmDialog>

      <Modal
        open={!!reopening}
        title={t('months.reopenTitle', { month: reopening ? formatMonth(reopening, lang) : '' })}
        description={t('months.reopenHint')}
        submitLabel={t('months.reopen')}
        busy={busy}
        onSubmit={reopenMonth}
        onClose={() => setReopening(null)}
      >
        {dialogError && <Alert tone="error">{dialogError}</Alert>}
        <Field label={t('months.reason')}>
          {(id, d) => <TextArea id={id} aria-describedby={d} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </Modal>
    </div>
  );
}
