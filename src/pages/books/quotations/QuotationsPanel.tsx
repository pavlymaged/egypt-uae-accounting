import { ChevronRight, FileText, Hourglass, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { ScreenErrorBoundary } from '../../../components/ui/ScreenErrorBoundary';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDate, todayIn } from '../../../lib/dates';
import { matchesQuery } from '../../../lib/search';
import { supabase } from '../../../lib/supabase';
import type { BooksAccess } from '../books';
import { ListToolbar } from '../ListToolbar';
import { ENGAGEMENT_COLUMNS, type Engagement } from '../vendors/vendors';
import { NewQuotationDialog } from './NewQuotationDialog';
import { QuotationActions } from './QuotationActions';
import { QuotationDetail } from './QuotationDetail';
import { QuotationEditor } from './QuotationEditor';
import { QuotationStateBadges, TotalsTriple } from './QuotationParts';
import { QUOTATION_COLUMNS, QUOTATION_STATES, STATE_LABEL, type Quotation, type QuotationState } from './quotations';

type Chip = 'all' | 'waiting' | QuotationState;
type Notice = { tone: 'success' | 'error'; text: string };

interface QuotationData {
  quotations: Quotation[];
  engagements: Engagement[];
  today: string;
}

export function QuotationsPanel({ access }: { access: BooksAccess }) {
  return (
    <ScreenErrorBoundary>
      <QuotationsView access={access} />
    </ScreenErrorBoundary>
  );
}

function QuotationsView({ access }: { access: BooksAccess }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<QuotationData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedAttempt, setLoadedAttempt] = useState(-1);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<Chip>(() => (params.get('waiting') === '1' ? 'waiting' : 'all'));
  const [vendor, setVendor] = useState('');
  const [project, setProject] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    Promise.all([
      supabase
        .from('quotations_list')
        .select(QUOTATION_COLUMNS)
        .eq('company_id', access.companyId)
        .order('quotation_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('vendor_engagements_list').select(ENGAGEMENT_COLUMNS).eq('company_id', access.companyId).order('project_code').order('profession').order('serial'),
      supabase.from('companies').select('time_zone').eq('id', access.companyId).maybeSingle(),
    ]).then(([quotations, engagements, company]) => {
      if (cancelled) return;
      if (quotations.error || engagements.error || company.error) return setFailed(true);
      if (!Array.isArray(quotations.data) || !Array.isArray(engagements.data)) return setFailed(true);
      setData({
        quotations: quotations.data as unknown as Quotation[],
        engagements: engagements.data as unknown as Engagement[],
        today: todayIn(company.data?.time_zone ?? null),
      });
      setLoadedAttempt(attempt);
    });
    return () => {
      cancelled = true;
    };
  }, [access.companyId, attempt]);

  useEffect(() => {
    if (params.get('waiting') !== '1') return;
    setChip('waiting');
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('waiting');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  const all = useMemo(() => data?.quotations ?? [], [data]);

  const counts = useMemo(() => {
    const map = new Map<Chip, number>([['all', all.length], ['waiting', all.filter((q) => q.can_decide).length]]);
    for (const s of QUOTATION_STATES) map.set(s, all.filter((q) => q.state === s).length);
    return map;
  }, [all]);

  const vendors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of all) if (!seen.has(q.vendor_code)) seen.set(q.vendor_code, q.vendor_name);
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);

  const projects = useMemo(() => {
    const seen = new Map<string, { code: string; name: string }>();
    for (const q of all) if (!seen.has(q.project_id)) seen.set(q.project_id, { code: q.project_code, name: q.project_name });
    return [...seen.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  }, [all]);

  const visible = useMemo(
    () =>
      all.filter(
        (q) =>
          (chip === 'all' || (chip === 'waiting' ? q.can_decide : q.state === chip)) &&
          (!vendor || q.vendor_code === vendor) &&
          (!project || q.project_id === project) &&
          (!from || q.quotation_date >= from) &&
          (!to || q.quotation_date <= to) &&
          matchesQuery(query, [q.reference, q.vendor_code, q.vendor_name, q.project_code, q.project_name, q.notes]),
      ),
    [all, chip, vendor, project, from, to, query],
  );

  const openId = params.get('quotation');
  const editing = params.get('edit') === '1';
  const open = all.find((q) => q.quotation_id === openId) ?? null;

  const go = (id: string | null, edit = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('quotation', id);
        else next.delete('quotation');
        if (edit) next.set('edit', '1');
        else next.delete('edit');
        return next;
      },
      { replace: !id },
    );

  const refresh = () => setAttempt((a) => a + 1);
  const done = (id: string) => (text: string, openEditor?: boolean) => {
    setNotice({ tone: 'success', text });
    refresh();
    if (openEditor) go(id, true);
  };

  if (failed) {
    return (
      <Alert tone="error" action={<Button variant="secondary" onClick={refresh}>{t('common.retry')}</Button>}>
        {t('common.loadFailed')}
      </Alert>
    );
  }
  if (!data) return <Spinner label={t('common.loading')} />;

  const noticeEl = notice && <Alert tone={notice.tone}>{notice.text}</Alert>;

  if (openId) {
    if (!open) {
      if (loadedAttempt !== attempt) return <Spinner label={t('common.loading')} />;
      return (
        <EmptyState icon={<FileText className="h-6 w-6" />} title={t('books.notFound')}>
          <Button variant="secondary" onClick={() => go(null)}>{t('quotations.backToList')}</Button>
        </EmptyState>
      );
    }
    if (editing && open.can_edit) {
      return (
        <QuotationEditor
          key={open.latest_revision_id}
          quotation={open}
          access={access}
          onClose={() => go(open.quotation_id)}
          onSaved={refresh}
          onSubmitted={(text) => {
            setNotice({ tone: 'success', text });
            refresh();
            go(open.quotation_id);
          }}
        />
      );
    }
    return (
      <div className="space-y-4">
        {noticeEl}
        {editing && !open.can_edit && <Alert tone="info">{t('quotations.notEditable')}</Alert>}
        <QuotationDetail quotation={open} onBack={() => go(null)} onEdit={() => go(open.quotation_id, true)} onDone={done(open.quotation_id)} />
      </div>
    );
  }

  const chips: Chip[] = ['all', 'waiting', ...QUOTATION_STATES];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-600">{t('quotations.intro')}</p>
        {access.canEditQuotations && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('quotations.add')}</Button>
        )}
      </div>
      {noticeEl}

      <div role="tablist" aria-label={t('books.col.status')} className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const selected = chip === c;
          const label = c === 'all' ? t('books.filter.all') : c === 'waiting' ? t('quotations.waitingOwner') : t(STATE_LABEL[c]);
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setChip(c)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selected
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : c === 'waiting'
                    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              {c === 'waiting' && <Hourglass className="h-3.5 w-3.5" />}
              {label}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'}`}>{counts.get(c) ?? 0}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <ListToolbar query={query} onQuery={setQuery} placeholder={t('quotations.search')}>
          <SelectInput aria-label={t('quotations.field.vendor')} value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-52">
            <option value="">{t('quotations.allVendors')}</option>
            {vendors.map(([code, name]) => (
              <option key={code} value={code}>{`${code} - ${name}`}</option>
            ))}
          </SelectInput>
          <SelectInput aria-label={t('quotations.field.project')} value={project} onChange={(e) => setProject(e.target.value)} className="w-52">
            <option value="">{t('vendors.allProjects')}</option>
            {projects.map(([id, p]) => (
              <option key={id} value={id}>{`${p.code} - ${p.name}`}</option>
            ))}
          </SelectInput>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            {t('payments.from')}
            <TextInput type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            {t('payments.to')}
            <TextInput type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </label>
        </ListToolbar>

        {visible.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title={all.length === 0 ? t('quotations.empty') : t('books.noMatch')}>
            {all.length === 0 && <p className="text-sm text-ink-500">{access.canEditQuotations ? t('quotations.emptyHint') : t('quotations.emptyViewer')}</p>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map((q) => {
              const approved = q.state === 'approved';
              return (
                <li key={q.quotation_id} className="transition-colors hover:bg-brand-50/30">
                  <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
                    <button
                      type="button"
                      onClick={() => go(q.quotation_id)}
                      className="grid min-w-0 flex-1 gap-x-6 gap-y-2 rounded-lg text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,20rem)]"
                    >
                      <div className="space-y-1">
                        <p dir="ltr" className="font-mono text-sm font-semibold text-ink-900 rtl:text-end">{q.reference}</p>
                        <p className="text-xs tabular-nums text-ink-500">{formatDate(q.quotation_date, lang)} <span dir="ltr">· {q.currency}</span></p>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium text-ink-900">
                          <span dir="ltr" className="me-1.5 font-mono text-sm text-ink-500">{q.vendor_code}</span>
                          <span dir="auto">{q.vendor_name}</span>
                        </p>
                        <p className="truncate text-sm text-ink-600">
                          <span dir="ltr" className="me-1.5 font-mono text-xs text-ink-400">{q.project_code}</span>
                          <span dir="auto">{q.project_name}</span>
                        </p>
                        <QuotationStateBadges quotation={q} />
                      </div>
                      <TotalsTriple
                        compact
                        currency={q.currency}
                        client={approved ? q.approved_client_total : q.state === 'draft' || q.state === 'submitted' ? q.latest_client_total : null}
                        office={approved ? q.approved_office_total : q.state === 'draft' || q.state === 'submitted' ? q.latest_office_total : null}
                        commission={approved ? q.approved_commission : null}
                      />
                    </button>
                    <div className="flex flex-wrap items-center gap-1 xl:justify-end">
                      <QuotationActions quotation={q} onEdit={() => go(q.quotation_id, true)} onDone={done(q.quotation_id)} />
                      <ChevronRight className="hidden h-5 w-5 shrink-0 text-ink-300 rtl:-scale-x-100 xl:block" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <NewQuotationDialog
        open={creating}
        access={access}
        engagements={data.engagements}
        engagementId={null}
        today={data.today}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          refresh();
          go(id, true);
        }}
      />
    </div>
  );
}
