import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info' | 'warning';

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: <AlertCircle className="h-4 w-4 shrink-0 text-red-600" /> },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> },
  info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: <Info className="h-4 w-4 shrink-0 text-brand-600" /> },
  warning: { box: 'border-gold-200 bg-gold-50 text-gold-900', icon: <AlertCircle className="h-4 w-4 shrink-0 text-gold-600" /> },
};

export function Alert({ tone, children, action }: { tone: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex animate-fade-in items-start gap-3 rounded-lg border px-4 py-3 text-sm ${tones[tone].box}`}>
      <span className="mt-0.5">{tones[tone].icon}</span>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
      {label}
    </div>
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-500">{icon}</div>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {children}
    </div>
  );
}

type BadgeTone = 'neutral' | 'brand' | 'gold' | 'success' | 'warning' | 'danger' | 'sky';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  gold: 'bg-gold-50 text-gold-800 ring-gold-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-ink-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function FormSection({ title, description, children, aside }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          {description && <div className="mt-1 text-sm text-ink-500">{description}</div>}
        </div>
        {aside}
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 space-y-3">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
