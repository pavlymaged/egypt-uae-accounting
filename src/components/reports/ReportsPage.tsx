import { useOrganization } from '../../contexts/OrganizationContext';
import { BarChart3, TrendingUp, PieChart, FileText } from 'lucide-react';

export default function ReportsPage() {
  const { currentOrganization } = useOrganization();

  const reports = [
    {
      name: 'Profit & Loss',
      description: 'Income statement showing revenue and expenses',
      icon: TrendingUp,
      color: 'blue',
    },
    {
      name: 'Balance Sheet',
      description: 'Statement of financial position',
      icon: BarChart3,
      color: 'green',
    },
    {
      name: 'Cash Flow',
      description: 'Cash flow statement',
      icon: PieChart,
      color: 'purple',
    },
    {
      name: 'VAT Summary',
      description: 'VAT report for tax filing',
      icon: FileText,
      color: 'orange',
    },
    {
      name: 'AR Aging',
      description: 'Accounts receivable aging report',
      icon: FileText,
      color: 'red',
    },
    {
      name: 'AP Aging',
      description: 'Accounts payable aging report',
      icon: FileText,
      color: 'yellow',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Financial Reports</h1>
        <p className="text-slate-600">
          Generate and export financial reports for {currentOrganization?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report, index) => {
          const Icon = report.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition cursor-pointer"
            >
              <div className={`w-12 h-12 bg-${report.color}-50 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 text-${report.color}-600`} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{report.name}</h3>
              <p className="text-sm text-slate-600">{report.description}</p>
              <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm">
                Generate Report →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
