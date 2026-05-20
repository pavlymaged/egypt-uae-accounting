import { useEffect, useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { BookOpen } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  account_subtype: string | null;
  current_balance: number;
  is_system: boolean;
  is_active: boolean;
}

export default function AccountsPage() {
  const { currentOrganization } = useOrganization();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) {
      fetchAccounts();
    }
  }, [currentOrganization]);

  const fetchAccounts = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('code', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentOrganization?.base_currency || 'USD',
    }).format(amount);
  };

  const getAccountTypeLabel = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.account_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Chart of Accounts</h1>
        <p className="text-slate-600">View and manage your accounting structure</p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedAccounts).map(([type, accs]) => (
          <div key={type} className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {getAccountTypeLabel(type)}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Code</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase">Type</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-600 uppercase">Balance</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {accs.map((account) => (
                    <tr key={account.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {account.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {account.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {account.account_subtype ? getAccountTypeLabel(account.account_subtype) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right text-slate-900">
                        {formatCurrency(account.current_balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
