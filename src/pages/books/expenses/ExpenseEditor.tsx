import { ArrowLeft, CopyPlus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatNumber } from '../../../lib/money';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, type BooksAccess } from '../books';
import { baseTotal, blankLine, CHECK_COLUMNS, currencyTotals, LINE_COLUMNS, MAX_LINES, newKey, draftFromLine, splitLineErrors, toPayload, type ExpenseLine, type LineCheck, type LineDraft } from './expenses';
import { LineCard, LineRow, type LineContext } from './ExpenseLine';

type Next = 'none' | 'submit' | 'post';
export type SavedResult = { entryId: string; tone: 'success' | 'error'; text: string };

interface Props {
  access: BooksAccess;
  ctx: LineContext;
  entryId: string | null;
  today: string;
  onLeave: () => void;
  onSaved: (result: SavedResult) => void;
}

/** Loads the current lines of a batch before opening the editor on it. */
export function ExpenseEditor(props: Props) {
  const { t } = useI18n();
  const [initial, setInitial] = useState<LineDraft[] | null>(props.entryId ? null : [blankLine(props.today)]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { entryId } = props;

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    setFailed(false);
    supabase
      .from('expense_lines_list')
      .select(LINE_COLUMNS)
      .eq('entry_id', entryId)
      .order('line_no')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        const rows = data as unknown as ExpenseLine[];
        setInitial(rows.length ? rows.map(draftFromLine) : [blankLine(props.today)]);
      });
    return () => {
      cancelled = true;
    };
  }, [entryId, attempt, props.today]);

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!initial) return <Spinner label={t('common.loading')} />;
  return <BatchEditor {...props} initial={initial} />;
}

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

function BatchEditor({ access, ctx, entryId: startId, initial, onLeave, onSaved }: Props & { initial: LineDraft[] }) {
  const { t } = useI18n();
  const desktop = useIsDesktop();
  const [entryId] = useState(startId);
  const [lines, setLines] = useState<LineDraft[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [checks, setChecks] = useState<Map<string, LineCheck>>(new Map());
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Next | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const request = ++latest.current;
    const keys = lines.map((l) => l.key);
    const payload = toPayload(lines, ctx.accountById, ctx.base);
    setChecking(true);
    const timer = window.setTimeout(async () => {
      const { data, error: rpcError } = await supabase
        .rpc('check_expense_lines', { p_company: access.companyId, p_entry: entryId, p_lines: payload })
        .select(CHECK_COLUMNS);
      if (request !== latest.current) return;
      setChecking(false);
      if (rpcError || !Array.isArray(data)) {
        setChecks(new Map());
        return setCheckError(dbErrorText(rpcError, t));
      }
      setCheckError(null);
      const next = new Map<string, LineCheck>();
      for (const row of data as unknown as LineCheck[]) {
        const key = keys[row.line_no - 1];
        if (key) next.set(key, { ...row, error: row.error?.trim() ? row.error : null });
      }
      setChecks(next);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [lines, access.companyId, entryId, ctx.accountById, ctx.base, t]);

  const update = (next: LineDraft[]) => {
    setLines(next);
    setDirty(true);
    setSaveErrors(new Map());
    setError(null);
  };
  const change = (key: string, patch: Partial<LineDraft>) => update(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => lines.length > 1 && update(lines.filter((l) => l.key !== key));
  const copy = (index: number) => {
    if (lines.length >= MAX_LINES) return;
    const source = lines[index];
    const clone: LineDraft = { ...source, key: newKey(), amount: '', confirm_duplicate: false };
    update([...lines.slice(0, index + 1), clone, ...lines.slice(index + 1)]);
  };
  const add = (count: number) => {
    const room = Math.min(count, MAX_LINES - lines.length);
    if (room <= 0) return;
    const date = lines[lines.length - 1]?.line_date || initial[0]?.line_date || '';
    update([...lines, ...Array.from({ length: room }, () => blankLine(date))]);
  };

  const totals = useMemo(() => currencyTotals(lines, ctx.accountById), [lines, ctx.accountById]);
  const base = useMemo(() => (checking ? null : baseTotal(lines, lines.map((l) => checks.get(l.key)))), [lines, checks, checking]);
  const secondStep: Next = access.selfService ? (access.canPost ? 'post' : 'none') : 'submit';

  async function save(next: Next) {
    setBusy(next);
    setError(null);
    setSaveErrors(new Map());
    const { data, error: saveError } = await supabase.rpc('save_expense_batch', {
      p_company: access.companyId,
      p_entry: entryId,
      p_lines: toPayload(lines, ctx.accountById, ctx.base),
    });
    if (saveError || typeof data !== 'string') {
      setBusy(null);
      const text = dbErrorText(saveError, t);
      const { byLine, rest } = splitLineErrors(text);
      setSaveErrors(new Map([...byLine].filter(([n]) => lines[n - 1]).map(([n, msg]) => [lines[n - 1].key, msg])));
      return setError(byLine.size ? rest || t('expenses.fixLines', { count: byLine.size }) : text);
    }
    setDirty(false);
    if (next === 'none') {
      setBusy(null);
      return onSaved({ entryId: data, tone: 'success', text: t('expenses.savedDraft') });
    }
    const { error: nextError } = await supabase.rpc(next === 'submit' ? 'submit_entry' : 'post_entry', { p_entry: data });
    setBusy(null);
    if (nextError) return onSaved({ entryId: data, tone: 'error', text: t('payments.nextRefused', { message: dbErrorText(nextError, t) }) });
    onSaved({ entryId: data, tone: 'success', text: t(next === 'submit' ? 'expenses.done.submitted' : 'expenses.done.posted') });
  }

  const lineProps = (line: LineDraft, index: number) => ({
    ctx,
    line,
    index,
    check: checks.get(line.key),
    saveError: saveErrors.get(line.key),
    checking,
    canRemove: lines.length > 1,
    onChange: (patch: Partial<LineDraft>) => change(line.key, patch),
    onRemove: () => remove(line.key),
    onCopy: () => copy(index),
  });

  const leave = () => (dirty ? setConfirmLeave(true) : onLeave());
  const full = lines.length >= MAX_LINES;

  return (
    <div className="animate-fade-in space-y-5">
      <button type="button" onClick={leave} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
        {t('expenses.backToList')}
      </button>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-ink-900">{entryId ? t('expenses.editTitle') : t('expenses.addTitle')}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{t('expenses.editorHint')}</p>
      </div>

      {error && <Alert tone="error"><span className="whitespace-pre-line">{error}</span></Alert>}
      {checkError && !error && <Alert tone="warning"><span className="whitespace-pre-line">{checkError}</span></Alert>}

      {desktop ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[110rem] text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/70 text-start text-xs font-medium uppercase tracking-wide text-ink-500">
                  {['#', t('payments.field.date'), t('payments.field.project'), t('expenses.field.account'), t('expenses.field.category'), t('expenses.field.item'), t('expenses.field.description'), t('payments.field.amount'), t('payments.field.rate'), t('expenses.field.returnShort'), t('expenses.field.receipt'), ''].map((h, i) => (
                    <th key={i} className={`px-1.5 py-2.5 text-start font-medium ${i === 0 ? 'ps-3' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <LineRow key={line.key} {...lineProps(line, index)} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {lines.map((line, index) => (
            <LineCard key={line.key} {...lineProps(line, index)} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={full} onClick={() => add(1)}>{t('expenses.addLine')}</Button>
        <Button variant="secondary" icon={<CopyPlus className="h-4 w-4" />} disabled={full} onClick={() => add(5)}>{t('expenses.addFive')}</Button>
        <span className="text-sm text-ink-500">{t('expenses.lineCount', { count: lines.length, max: MAX_LINES })}</span>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-900">{t('expenses.totals')}</h3>
            {totals.length === 0 ? (
              <p className="text-sm text-ink-500">-</p>
            ) : (
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {totals.map((row) => (
                  <li key={row.currency} dir="ltr" className="text-sm tabular-nums text-ink-800">{`${formatNumber(row.total, row.currency)} ${row.currency}`}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-500">{t('expenses.totalsHint')}</p>
          </div>
          <div className="md:text-end">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t('expenses.baseTotal', { currency: ctx.base })}</p>
            <p dir="ltr" className="text-2xl font-semibold tabular-nums text-ink-900 rtl:text-end md:rtl:text-start">
              {base === null ? <span className="text-base font-normal text-ink-400">{checking ? t('expenses.checking') : t('expenses.baseWaiting')}</span> : `${formatNumber(base, ctx.base)} ${ctx.base}`}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 pt-5">
        <Button variant="ghost" disabled={busy !== null} onClick={leave}>{t('common.cancel')}</Button>
        <Button variant={secondStep === 'none' ? 'primary' : 'secondary'} loading={busy === 'none'} disabled={busy !== null} onClick={() => save('none')}>{t('payments.saveDraft')}</Button>
        {secondStep !== 'none' && (
          <Button loading={busy === secondStep} disabled={busy !== null} onClick={() => save(secondStep)}>
            {secondStep === 'submit' ? t('payments.saveSubmit') : t('payments.savePost')}
          </Button>
        )}
      </div>

      <ConfirmDialog open={confirmLeave} title={t('expenses.leaveTitle')} confirmLabel={t('expenses.leaveConfirm')} tone="danger" onCancel={() => setConfirmLeave(false)} onConfirm={onLeave}>
        {t('expenses.leaveBody')}
      </ConfirmDialog>
    </div>
  );
}
