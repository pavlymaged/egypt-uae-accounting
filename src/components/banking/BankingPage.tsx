import { useOrganization } from '../../contexts/OrganizationContext';
import { Landmark } from 'lucide-react';

export default function BankingPage() {
  const { currentOrganization } = useOrganization();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Banking & Reconciliation</h1>
        <p className="text-slate-600">Import transactions and reconcile bank accounts</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Landmark className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Banking Module</h2>
        <p className="text-slate-600 mb-4">
          Import bank transactions via CSV and match them with invoices, bills, and expenses.
        </p>
        <p className="text-sm text-slate-500">
          Currency: {currentOrganization?.base_currency || 'N/A'}
        </p>
      </div>
    </div>
  );
}
