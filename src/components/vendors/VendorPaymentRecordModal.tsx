import { useState, useMemo } from 'react';
import { X, DollarSign, Calendar, Check, AlertCircle } from 'lucide-react';

export interface VendorPaymentProps {
  vendorName: string;
  quotationNumber?: string;
  clientTotalQuotation: number;
  officeTotalQuotation: number;
  clientPreviouslyPaid: number;
  officePreviouslyPaid: number;
  currency?: string;
  onSubmit: (paymentData: PaymentRecord) => void;
  onCancel: () => void;
}

export interface PaymentRecord {
  date: string;
  method: string;
  reference?: string;
  clientAmount: number;
  officeAmount: number;
}

export default function VendorPaymentRecordModal({
  vendorName,
  quotationNumber,
  clientTotalQuotation,
  officeTotalQuotation,
  clientPreviouslyPaid,
  officePreviouslyPaid,
  currency = 'USD',
  onSubmit,
  onCancel,
}: VendorPaymentProps) {
  const [clientAmount, setClientAmount] = useState(0);
  const [officeAmount, setOfficeAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [useClientCheck, setUseClientCheck] = useState(false);
  const [useOfficeCheck, setUseOfficeCheck] = useState(false);

  const clientBalance = clientTotalQuotation - clientPreviouslyPaid;
  const officeBalance = officeTotalQuotation - officePreviouslyPaid;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (clientAmount > clientBalance) errs.push(`Client amount exceeds balance (${formatCurrency(clientBalance)})`);
    if (officeAmount > officeBalance) errs.push(`Office amount exceeds balance (${formatCurrency(officeBalance)})`);
    if (clientAmount < 0) errs.push('Client amount cannot be negative');
    if (officeAmount < 0) errs.push('Office amount cannot be negative');
    return errs;
  }, [clientAmount, officeAmount, clientBalance, officeBalance]);

  const canSubmit = errors.length === 0 && (clientAmount > 0 || officeAmount > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      date: paymentDate,
      method: paymentMethod,
      reference: reference || undefined,
      clientAmount,
      officeAmount,
    });
  };

  const handleClientCheckToggle = () => {
    if (!useClientCheck) {
      setClientAmount(clientBalance);
      setUseClientCheck(true);
    } else {
      setClientAmount(0);
      setUseClientCheck(false);
    }
  };

  const handleOfficeCheckToggle = () => {
    if (!useOfficeCheck) {
      setOfficeAmount(officeBalance);
      setUseOfficeCheck(true);
    } else {
      setOfficeAmount(0);
      setUseOfficeCheck(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Record Payment</h2>
            <p className="text-sm text-slate-600 mt-1">
              {vendorName}{quotationNumber ? ` - ${quotationNumber}` : ''}
            </p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Payment Summary Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">Description</th>
                  <th className="text-center px-5 py-3 text-sm font-semibold text-slate-700 w-24">Check</th>
                  <th className="text-right px-5 py-3 text-sm font-semibold text-blue-700 w-40">Client</th>
                  <th className="text-right px-5 py-3 text-sm font-semibold text-blue-700 w-40">Office</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Total Quotation Row */}
                <tr className="bg-white">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">Total Project Quotation</td>
                  <td className="px-5 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={useClientCheck && useOfficeCheck}
                      onChange={() => {
                        const allChecked = useClientCheck && useOfficeCheck;
                        if (!allChecked) {
                          setClientAmount(clientBalance);
                          setOfficeAmount(officeBalance);
                          setUseClientCheck(true);
                          setUseOfficeCheck(true);
                        } else {
                          setClientAmount(0);
                          setOfficeAmount(0);
                          setUseClientCheck(false);
                          setUseOfficeCheck(false);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">
                    {formatCurrency(clientTotalQuotation)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-900">
                    {formatCurrency(officeTotalQuotation)}
                  </td>
                </tr>

                {/* Previously Paid Row */}
                <tr className="bg-white">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-900">Total Payments</td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => { handleClientCheckToggle(); handleOfficeCheckToggle(); }}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
                    >
                      Check
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-slate-700">
                    {formatCurrency(clientPreviouslyPaid)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-slate-700">
                    {formatCurrency(officePreviouslyPaid)}
                  </td>
                </tr>

                {/* Quotation Balance Row */}
                <tr className="bg-amber-50/70">
                  <td className="px-5 py-3.5 text-sm font-bold text-slate-900">Balance</td>
                  <td className="px-5 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={useClientCheck}
                      onChange={handleClientCheckToggle}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className={`px-5 py-3.5 text-right text-sm font-bold ${clientBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {formatCurrency(clientBalance)}
                  </td>
                  <td className={`px-5 py-3.5 text-right text-sm font-bold ${officeBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {formatCurrency(officeBalance)}
                  </td>
                </tr>

                {/* Amount to Record Row */}
                <tr className="bg-blue-50/50 border-t-2 border-blue-200">
                  <td className="px-5 py-3.5 text-sm font-bold text-blue-900">Payment</td>
                  <td className="px-5 py-3.5"></td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={clientAmount}
                      onChange={(e) => {
                        setClientAmount(parseFloat(e.target.value) || 0);
                        setUseClientCheck(false);
                      }}
                      className={`w-full px-3 py-2 text-right text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 ${
                        clientAmount > clientBalance
                          ? 'border-red-300 bg-red-50 focus:ring-red-500 text-red-900'
                          : 'border-slate-200 bg-white focus:ring-blue-500 text-slate-900'
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={officeAmount}
                      onChange={(e) => {
                        setOfficeAmount(parseFloat(e.target.value) || 0);
                        setUseOfficeCheck(false);
                      }}
                      className={`w-full px-3 py-2 text-right text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 ${
                        officeAmount > officeBalance
                          ? 'border-red-300 bg-red-50 focus:ring-red-500 text-red-900'
                          : 'border-slate-200 bg-white focus:ring-blue-500 text-slate-900'
                      }`}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Additional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4" />
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <DollarSign className="w-4 h-4" />
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Cheque</option>
                <option value="card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Reference / Note</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Payment reference, cheque number, etc."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Total being recorded summary */}
          {(clientAmount > 0 || officeAmount > 0) && errors.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-green-800">Total Payment Amount</span>
              <span className="text-lg font-bold text-green-900">{formatCurrency(clientAmount + officeAmount)}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
