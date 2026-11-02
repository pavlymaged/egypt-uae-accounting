import { ExternalLink, MessageSquareWarning } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '../../components/ui/Feedback';
import { Field, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate } from '../../lib/dates';
import { formatNumber } from '../../lib/money';
import type { Currency } from '../../types';
import { balanceSide, isSafeLink, STATE_LABEL, STATE_TONE, type ClaimState, type SiteClaim } from './claims';

export function ClaimStateBadge({ state }: { state: ClaimState }) {
  const { t } = useI18n();
  const label = STATE_LABEL[state];
  return <Badge tone={STATE_TONE[state] ?? 'neutral'}>{label ? t(label) : state}</Badge>;
}

export function ReceiptLink({ link }: { link: string | null }) {
  const { t } = useI18n();
  if (!isSafeLink(link)) return link ? <span dir="ltr" className="break-all text-sm text-ink-500">{link}</span> : null;
  return (
    <a
      href={link.trim()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-md text-sm font-medium text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <ExternalLink className="h-4 w-4" />
      {t('claims.openReceipt')}
    </a>
  );
}

export function Money({ value, currency, className = '' }: { value: string | null; currency: Currency; className?: string }) {
  return <span dir="ltr" className={`tabular-nums ${className}`}>{`${formatNumber(value, currency)} ${currency}`}</span>;
}

/** Wording for a custody balance; negative means the company owes the engineer. */
export function CustodyBalance({ balance, currency, view, size = 'md' }: { balance: string | null; currency: Currency; view: 'engineer' | 'company'; size?: 'md' | 'lg' }) {
  const { t } = useI18n();
  const { side, magnitude } = balanceSide(balance);
  const big = size === 'lg';
  if (side === 'even') return <p className={big ? 'text-lg font-medium text-ink-700' : 'text-sm text-ink-600'}>{t(view === 'engineer' ? 'custody.even' : 'engineers.even')}</p>;
  const label = side === 'owed' ? t(view === 'engineer' ? 'custody.owesYou' : 'engineers.owes') : t(view === 'engineer' ? 'custody.holding' : 'engineers.holding');
  const tone = side === 'owed' ? 'text-emerald-700' : 'text-gold-700';
  return (
    <div>
      <p className={big ? 'text-sm font-medium text-ink-600' : 'text-xs text-ink-500'}>{label}</p>
      <Money value={magnitude} currency={currency} className={`${tone} ${big ? 'mt-1 block text-4xl font-semibold tracking-tight' : 'text-base font-semibold'}`} />
    </div>
  );
}

export function OfficeComment({ comment }: { comment: string }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-3 rounded-lg border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">{t('claims.officeComment')}</p>
        <p dir="auto" className="mt-0.5 whitespace-pre-line">{comment}</p>
      </div>
    </div>
  );
}

export function ClaimSummary({ claim: c, currency, showEngineer = false, actions }: { claim: SiteClaim; currency: Currency; showEngineer?: boolean; actions?: ReactNode }) {
  const { lang } = useI18n();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span>{formatDate(c.claim_date, lang)}</span>
            <ClaimStateBadge state={c.state} />
          </div>
          {showEngineer && <p className="font-medium text-ink-900">{c.engineer_name ?? '-'}</p>}
          <p className={`${showEngineer ? 'text-sm text-ink-700' : 'font-medium text-ink-900'}`}>
            <span dir="ltr" className="font-mono text-xs text-ink-500">{c.project_code ?? ''}</span> {c.project_name ?? ''}
          </p>
        </div>
        <Money value={c.amount} currency={currency} className="text-lg font-semibold text-ink-900" />
      </div>
      {c.description && <p dir="auto" className="text-sm text-ink-700">{c.description}</p>}
      {c.state === 'rejected' && c.reject_comment && <OfficeComment comment={c.reject_comment} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReceiptLink link={c.receipt_link} />
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface ReasonProps {
  open: boolean;
  title: string;
  hint: string;
  label: string;
  minLength: number;
  submitLabel: string;
  tone?: 'primary' | 'danger';
  busy: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

export function ReasonDialog({ open, title, hint, label, minLength, submitLabel, tone = 'primary', busy, error, onSubmit, onClose }: ReasonProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [tooShort, setTooShort] = useState(false);
  useEffect(() => {
    if (open) {
      setText('');
      setTooShort(false);
    }
  }, [open]);
  const submit = () => {
    if (text.trim().length < minLength) return setTooShort(true);
    onSubmit(text.trim());
  };
  return (
    <Modal open={open} title={title} description={hint} submitLabel={submitLabel} submitTone={tone} busy={busy} onSubmit={submit} onClose={onClose}>
      <Field label={label} error={tooShort ? t('claims.tooShort', { n: minLength }) : error}>
        {(id, d, invalid) => <TextArea id={id} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={d} invalid={invalid} dir="auto" rows={3} />}
      </Field>
    </Modal>
  );
}
