import { useOrganization } from '../../contexts/OrganizationContext';
import { FileSpreadsheet } from 'lucide-react';

export default function JournalEntriesPage() {
  const { currentOrganization } = useOrganization();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Journal Entries</h1>
        <p className="text-slate-600">Create and manage manual journal entries</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-8 h-8 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Journal Entries Module</h2>
        <p className="text-slate-600 mb-4">
          Create manual journal entries for adjustments and corrections.
        </p>
        <p className="text-sm text-slate-500">
          Currency: {currentOrganization?.base_currency || 'N/A'}
        </p>
      </div>
    </div>
  );
}
