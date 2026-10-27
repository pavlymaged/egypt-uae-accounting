import type { BooksAccess } from './books';
import { CashAccountsPanel } from './CashAccountsPanel';
import { ClientsPanel } from './ClientsPanel';
import { ProjectsPanel } from './ProjectsPanel';

export type BookSection = 'projects' | 'clients' | 'cash';

export function BookPanel({ section, access }: { section: BookSection; access: BooksAccess }) {
  if (section === 'projects') return <ProjectsPanel access={access} />;
  if (section === 'clients') return <ClientsPanel access={access} />;
  return <CashAccountsPanel access={access} />;
}
