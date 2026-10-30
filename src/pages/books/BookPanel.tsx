import type { BooksAccess } from './books';
import { CashAccountsPanel } from './CashAccountsPanel';
import { ClientsPanel } from './ClientsPanel';
import { ExpensesPanel } from './expenses/ExpensesPanel';
import { FeeChargesPanel } from './fees/FeeChargesPanel';
import { MonthsPanel } from './MonthsPanel';
import { PaymentsPanel } from './payments/PaymentsPanel';
import { ProjectsPanel } from './ProjectsPanel';

export type BookSection = 'projects' | 'clients' | 'cash' | 'payments' | 'expenses' | 'fees' | 'months';

/** `routed` is the member menu (one page per section); otherwise the sections are tabs on a company page. */
export function BookPanel({ section, access, routed = false }: { section: BookSection; access: BooksAccess; routed?: boolean }) {
  const chargeHref = (entryId: string) => `${routed ? '/fee-charges' : ''}?${new URLSearchParams(routed ? { charge: entryId } : { tab: 'fees', charge: entryId })}`;
  if (section === 'projects') return <ProjectsPanel access={access} chargeHref={chargeHref} />;
  if (section === 'clients') return <ClientsPanel access={access} />;
  if (section === 'payments') return <PaymentsPanel access={access} />;
  if (section === 'expenses') return <ExpensesPanel access={access} />;
  if (section === 'fees') return <FeeChargesPanel access={access} />;
  if (section === 'months') return <MonthsPanel access={access} />;
  return <CashAccountsPanel access={access} />;
}
