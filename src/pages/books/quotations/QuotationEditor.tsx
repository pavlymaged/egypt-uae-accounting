import { ArrowLeft, FileText, Plus, Save, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate } from '../../../lib/dates';
import { supabase } from '../../../lib/supabase';
import { dbErrorText, type BooksAccess } from '../books';
import { emptyLine, fromSaved, lineMessages, newKey, toPayload, useLineCheck, type LineDraft } from './lineDrafts';
import { TotalsTriple } from './QuotationParts';
import { QuotationLineRow } from './QuotationLineRow';
import { LINE_COLUMNS, sumText, type Quotation, type QuotationLine } from './quotations';

interface Props {
  quotation: Quotation;
  access: BooksAccess;
  onClose: () => void;
  onSaved: () => void;
  onSubmitted: (text: string) => void;
}

type Notice = { tone: 'success' | 'error'; text: string };

export function QuotationEditor({ quotation: q, access, onClose, onSaved, onSubmitted }: Props) {
  const { t, lang } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<LineDraft[] | null>(null);
  const [saved, setSaved] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lineErrors, setLineErrors] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    supabase
      .from('quotation_lines_list')
      .select(LINE_COLUMNS)
      .eq('revision_id', q.latest_revision_id)
      .order('line_no')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setLoadFailed(true);
        const loaded = (data as unknown as QuotationLine[]).map(fromSaved);
        setSaved(JSON.stringify(toPayload(loaded)));
        setLines(loaded.length ? loaded : [emptyLine()]);
      });
    return () => {
      cancelled = true;
    };
  }, [q.latest_revision_id, attempt]);

  const current = lines ?? [];
  const check = useLineCheck(access.companyId, q.currency, current);
  const results = check.kind === 'ready' || check.kind === 'checking' ? check.results : undefined;
  const payloadKey = JSON.stringify(toPayload(current));
  const blank = current.length === 1 && JSON.stringify(toPayload([emptyLine()])) === payloadKey;
  const dirty = lines !== null && payloadKey !== saved && !(saved === '[]' && blank);

  const totals = useMemo(() => {
    const ok = [...(results?.values() ?? [])].filter((r) => !r.error && r.line_no <= current.length);
    return {
      office: sumText(ok.map((r) => r.office_total)),
      client: sumText(ok.map((r) => r.client_total)),
      commission: sumText(ok.map((r) => r.commission)),
      partial: ok.length < current.length,
    };
  }, [results, current.length]);

  useEffect(() => {
    if (!dirty) return;
    const warning = t('quotations.leaveWarning');
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = warning;
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest('a[href], [role="tab"]') : null;
      if (!target || rootRef.current?.contains(target)) return;
      if (!window.confirm(warning)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, t]);

  const update = (index: number, patch: Partial<LineDraft>) => {
    setLineErrors(new Map());
    setLines((prev) => (prev ?? []).map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };
  const remove = (index: number) => {
    setLineErrors(new Map());
    setLines((prev) => (prev ?? []).filter((_, i) => i !== index));
  };
  const copy = (index: number) => {
    setLineErrors(new Map());
    setLines((prev) => {
      const list = [...(prev ?? [])];
      list.splice(index + 1, 0, { ...list[index], key: newKey() });
      return list;
    });
  };
  const add = () => setLines((prev) => [...(prev ?? []), emptyLine()]);

  async function save(): Promise<boolean> {
    const payload = toPayload(current, results);
    const { error } = await supabase.rpc('save_quotation_lines', { p_company: access.companyId, p_revision: q.latest_revision_id, p_lines: payload });
    if (error) {
      const message = dbErrorText(error, t);
      const parsed = lineMessages(message);
      setLineErrors(parsed.lines);
      setNotice({ tone: 'error', text: parsed.lines.size ? [t('quotations.fixLines'), ...parsed.rest].join(' ') : message });
      return false;
    }
    setSaved(JSON.stringify(toPayload(current)));
    setLineErrors(new Map());
    return true;
  }

  async function onSave() {
    setBusy('save');
    setNotice(null);
    const ok = await save();
    setBusy(null);
    if (ok) {
      setNotice({ tone: 'success', text: t('quotations.done.saved') });
      onSaved();
    }
  }

  async function onSaveAndSubmit() {
    setBusy('submit');
    setNotice(null);
    const ok = await save();
    if (!ok) return setBusy(null);
    const { error } = await supabase.rpc('submit_quotation_revision', { p_revision: q.latest_revision_id });
    setBusy(null);
    if (error) {
      setNotice({ tone: 'error', text: `${t('quotations.savedNotSubmitted')} ${dbErrorText(error, t)}` });
      onSaved();
      return;
    }
    onSubmitted(t('quotations.done.submit'));
  }

  function leave() {
    if (dirty && !window.confirm(t('quotations.leaveWarning'))) return;
    onClose();
  }

  if (loadFailed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!lines) return <Spinner label={t('common.loading')} />;

  const stale = check.kind === 'checking';

  return (
    <div ref={rootRef} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />} onClick={leave}>{t('quotations.backToList')}</Button>
        {dirty && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">{t('quotations.unsaved')}</span>}
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{t('quotations.editingRevision', { n: q.latest_revision })}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-ink-900">{q.reference}</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t('quotations.field.vendorCode')} value={<span dir="ltr" className="font-mono">{q.vendor_code}</span>} />
              <Info label={t('quotations.field.vendor')} value={<span dir="auto">{q.vendor_name}</span>} />
              <Info label={t('quotations.field.date')} value={formatDate(q.quotation_date, lang)} />
              <Info label={t('quotations.field.currency')} value={<span dir="ltr">{q.currency}</span>} />
            </dl>
          </div>
        </div>
        {q.latest_revision > 1 && (
          <p className="mt-4 rounded-lg border-s-4 border-sky-500 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">{t('quotations.revisionNote', { n: q.latest_revision })}</p>
        )}
      </Card>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {check.kind === 'failed' && <Alert tone="error">{dbErrorText(check.error, t)}</Alert>}

      <Card>
        <div className="hidden grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.4fr)_6rem_5rem_7rem_7rem_4.5rem] gap-2 border-b border-ink-200 bg-ink-50/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-500 lg:grid">
          <span>#</span>
          <span>{t('quotations.field.description')}</span>
          <span>{t('quotations.field.link')}</span>
          <span className="text-end">{t('quotations.field.qty')}</span>
          <span>{t('quotations.field.unit')}</span>
          <span className="text-end">{t('quotations.field.officeUnit')}</span>
          <span className="text-end">{t('quotations.field.clientUnit')}</span>
          <span />
        </div>
        <ul className="space-y-3 p-3 lg:space-y-0 lg:p-0">
          {lines.map((line, i) => (
            <QuotationLineRow
              key={line.key}
              index={i}
              line={line}
              currency={q.currency}
              result={results?.get(i + 1)}
              saveError={lineErrors.get(i + 1)}
              stale={stale}
              canRemove={lines.length > 1}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              onCopy={() => copy(i)}
            />
          ))}
        </ul>
        <div className="border-t border-ink-100 p-3">
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={add}>{t('quotations.addLine')}</Button>
        </div>
      </Card>

      <Card className="sticky bottom-4 z-10 p-4 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1 space-y-1">
            <TotalsTriple currency={q.currency} client={totals.client} office={totals.office} commission={totals.commission} />
            {(totals.partial || stale) && <p className="text-xs text-ink-500">{stale ? t('quotations.checking') : t('quotations.totalsPartial')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={busy === 'save'} disabled={!!busy} onClick={onSave}>{t('quotations.saveLines')}</Button>
            <Button icon={<Send className="h-4 w-4" />} loading={busy === 'submit'} disabled={!!busy} onClick={onSaveAndSubmit}>{t('quotations.saveAndSubmit')}</Button>
          </div>
        </div>
      </Card>
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
