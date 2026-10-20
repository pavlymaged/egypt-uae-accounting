import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Phone, Mail, Globe, Hash, Percent, Calendar, LogOut } from 'lucide-react';

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    country: 'Egypt' as 'Egypt' | 'UAE',
    base_currency: 'EGP',
    address: '',
    phone: '',
    email: '',
    website: '',
    vat_registration_number: '',
    tax_registration_number: '',
    fiscal_year_start_month: 1,
    default_vat_rate: 14,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'fiscal_year_start_month' || name === 'default_vat_rate'
        ? parseFloat(value)
        : value
    }));
  };

  const handleCountryChange = (country: 'Egypt' | 'UAE') => {
    setFormData(prev => ({
      ...prev,
      country,
      base_currency: country === 'Egypt' ? 'EGP' : 'AED',
      default_vat_rate: country === 'Egypt' ? 14 : 5,
    }));
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out? Your progress will not be saved.')) {
      await signOut();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      console.log('[Onboarding] Starting organization creation...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[Onboarding] No active session found');
        throw new Error('No active session. Please sign out and sign in again.');
      }

      console.log('[Onboarding] Session valid, user ID:', session.user.id);
      console.log('[Onboarding] Form data:', {
        name: formData.name,
        country: formData.country,
        base_currency: formData.base_currency
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization`;
      console.log('[Onboarding] Calling edge function:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('[Onboarding] Response status:', response.status);
      const result = await response.json();
      console.log('[Onboarding] Response data:', result);

      if (!response.ok) {
        console.error('[Onboarding] Error from edge function:', result.error);
        throw new Error(result.error || 'Failed to create organization');
      }

      const orgId = result.organizationId;
      console.log('[Onboarding] Organization created successfully:', orgId);
      console.log('[Onboarding] Creating default accounts...');

      await createDefaultAccounts(orgId, formData.country);
      console.log('[Onboarding] Creating default tax rates...');

      await createDefaultTaxRates(orgId, formData.country, formData.default_vat_rate);
      console.log('[Onboarding] Refreshing organizations list...');

      await refreshOrganizations();
      console.log('[Onboarding] Organization creation complete!');
    } catch (err: any) {
      console.error('[Onboarding] Error during organization creation:', err);
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200 hover:shadow-sm"
            aria-label="Sign out and return to sign in page"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Welcome!</h1>
              <p className="text-slate-600">Set up your organization to get started</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Country / Market
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleCountryChange('Egypt')}
                  className={`p-4 border-2 rounded-lg text-center transition ${
                    formData.country === 'Egypt'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-3xl mb-2">🇪🇬</div>
                  <div className="font-semibold">Egypt</div>
                  <div className="text-xs text-slate-600 mt-1">EGP • 14% VAT</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleCountryChange('UAE')}
                  className={`p-4 border-2 rounded-lg text-center transition ${
                    formData.country === 'UAE'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-3xl mb-2">🇦🇪</div>
                  <div className="font-semibold">UAE</div>
                  <div className="text-xs text-slate-600 mt-1">AED • 5% VAT</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your Company Ltd."
                    required
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123 Main Street, City"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+20 123 456 789"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="info@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="www.company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {formData.country === 'UAE' ? 'TRN (Tax Registration Number)' : 'Tax Registration Number'}
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="tax_registration_number"
                    value={formData.tax_registration_number}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={formData.country === 'UAE' ? '123456789012345' : 'Tax ID'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  VAT Registration Number
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="vat_registration_number"
                    value={formData.vat_registration_number}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="VAT Number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Default VAT Rate (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    name="default_vat_rate"
                    value={formData.default_vat_rate}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fiscal Year Start Month
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    name="fiscal_year_start_month"
                    value={formData.fiscal_year_start_month}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>
                        {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Organization...' : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

async function createDefaultAccounts(orgId: string, country: 'Egypt' | 'UAE') {
  const defaultAccounts = [
    { code: '1000', name: 'Cash', type: 'asset', subtype: 'current_asset' },
    { code: '1100', name: 'Bank Accounts', type: 'asset', subtype: 'current_asset' },
    { code: '1200', name: 'Accounts Receivable', type: 'asset', subtype: 'current_asset' },
    { code: '1500', name: 'Inventory', type: 'asset', subtype: 'current_asset' },
    { code: '1600', name: 'Prepaid Expenses', type: 'asset', subtype: 'current_asset' },
    { code: '1800', name: 'Fixed Assets', type: 'asset', subtype: 'fixed_asset' },
    { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'current_liability' },
    { code: '2100', name: 'VAT Payable', type: 'liability', subtype: 'current_liability' },
    { code: '2110', name: 'VAT Recoverable', type: 'asset', subtype: 'current_asset' },
    { code: '2200', name: 'Accrued Expenses', type: 'liability', subtype: 'current_liability' },
    { code: '2500', name: 'Long-term Debt', type: 'liability', subtype: 'long_term_liability' },
    { code: '3000', name: 'Owner Equity', type: 'equity', subtype: 'equity' },
    { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings' },
    { code: '4000', name: 'Sales Revenue', type: 'revenue', subtype: 'operating_revenue' },
    { code: '4100', name: 'Service Revenue', type: 'revenue', subtype: 'operating_revenue' },
    { code: '4900', name: 'Other Income', type: 'revenue', subtype: 'other_revenue' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'cogs', subtype: 'direct_costs' },
    { code: '6000', name: 'Salaries & Wages', type: 'expense', subtype: 'operating_expense' },
    { code: '6100', name: 'Rent Expense', type: 'expense', subtype: 'operating_expense' },
    { code: '6200', name: 'Utilities Expense', type: 'expense', subtype: 'operating_expense' },
    { code: '6300', name: 'Office Supplies', type: 'expense', subtype: 'operating_expense' },
    { code: '6400', name: 'Marketing & Advertising', type: 'expense', subtype: 'operating_expense' },
    { code: '6500', name: 'Professional Fees', type: 'expense', subtype: 'operating_expense' },
    { code: '6600', name: 'Insurance Expense', type: 'expense', subtype: 'operating_expense' },
    { code: '6700', name: 'Depreciation Expense', type: 'expense', subtype: 'operating_expense' },
    { code: '6800', name: 'Bank Charges', type: 'expense', subtype: 'operating_expense' },
    { code: '6900', name: 'Miscellaneous Expenses', type: 'expense', subtype: 'operating_expense' },
  ];

  const accounts = defaultAccounts.map(acc => ({
    organization_id: orgId,
    code: acc.code,
    name: acc.name,
    account_type: acc.type,
    account_subtype: acc.subtype,
    is_system: true,
    currency: country === 'Egypt' ? 'EGP' : 'AED',
  }));

  await supabase.from('accounts').insert(accounts);
}

async function createDefaultTaxRates(orgId: string, country: 'Egypt' | 'UAE', defaultRate: number) {
  const taxRates = [
    {
      organization_id: orgId,
      name: `Standard VAT (${defaultRate}%)`,
      rate: defaultRate,
      tax_type: 'vat',
      is_default: true,
    },
    {
      organization_id: orgId,
      name: 'Zero Rated (0%)',
      rate: 0,
      tax_type: 'vat',
      is_default: false,
    },
    {
      organization_id: orgId,
      name: 'Exempt',
      rate: 0,
      tax_type: 'vat',
      is_default: false,
    },
  ];

  await supabase.from('tax_rates').insert(taxRates);
}
