import { EngineersPanel } from '../claims/EngineersPanel';
import { SiteClaimsPanel } from '../claims/SiteClaimsPanel';
import type { BooksAccess } from './books';
import { CashAccountsPanel } from './CashAccountsPanel';
import { ClientsPanel } from './ClientsPanel';
import { ExpensesPanel } from './expenses/ExpensesPanel';
import { FeeChargesPanel } from './fees/FeeChargesPanel';
import { MonthsPanel } from './MonthsPanel';
import { PaymentsPanel } from './payments/PaymentsPanel';
import { ProjectsPanel } from './ProjectsPanel';
import { QuotationsPanel } from './quotations/QuotationsPanel';
import { TransfersPanel } from './transfers/TransfersPanel';
import { VendorsPanel } from './vendors/VendorsPanel';

export type BookSection = 'projects' | 'clients' | 'cash' | 'payments' | 'expenses' | 'vendors' | 'quotations' | 'transfers' | 'claims' | 'engineers' | 'fees' | 'months';

/** `routed` is the member menu (one page per section); otherwise the sections are tabs on a company page. */
export function BookPanel({ section, access, routed = false }: { section: BookSection; access: BooksAccess; routed?: boolean }) {
  const chargeHref = (entryId: string) => `${routed ? '/fee-charges' : ''}?${new URLSearchParams(routed ? { charge: entryId } : { tab: 'fees', charge: entryId })}`;
  const quotationHref = (quotationId: string) =>
    `${routed ? '/quotations' : ''}?${new URLSearchParams(routed ? { quotation: quotationId, edit: '1' } : { tab: 'quotations', quotation: quotationId, edit: '1' })}`;
  if (section === 'projects') return <ProjectsPanel access={access} chargeHref={chargeHref} />;
  if (section === 'clients') return <ClientsPanel access={access} />;
  if (section === 'payments') return <PaymentsPanel access={access} />;
  if (section === 'expenses') return <ExpensesPanel access={access} />;
  if (section === 'vendors') return <VendorsPanel access={access} quotationHref={quotationHref} />;
  if (section === 'quotations') return <QuotationsPanel access={access} />;
  if (section === 'transfers') return <TransfersPanel access={access} />;
  if (section === 'claims') return <SiteClaimsPanel access={access} />;
  if (section === 'engineers') return <EngineersPanel access={access} />;
  if (section === 'fees') return <FeeChargesPanel access={access} />;
  if (section === 'months') return <MonthsPanel access={access} />;
  return <CashAccountsPanel access={access} />;
}
