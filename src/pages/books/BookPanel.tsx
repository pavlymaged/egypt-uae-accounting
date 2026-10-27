import type { BooksAccess } from './books';
import { CashAccountsPanel } from './CashAccountsPanel';
import { ClientsPanel } from './ClientsPanel';
import { MonthsPanel } from './MonthsPanel';
import { PaymentsPanel } from './payments/PaymentsPanel';
import { ProjectsPanel } from './ProjectsPanel';

export type BookSection = 'projects' | 'clients' | 'cash' | 'payments' | 'months';

export function BookPanel({ section, access }: { section: BookSection; access: BooksAccess }) {
  if (section === 'projects') return <ProjectsPanel access={access} />;
  if (section === 'clients') return <ClientsPanel access={access} />;
  if (section === 'payments') return <PaymentsPanel access={access} />;
  if (section === 'months') return <MonthsPanel access={access} />;
  return <CashAccountsPanel access={access} />;
}
