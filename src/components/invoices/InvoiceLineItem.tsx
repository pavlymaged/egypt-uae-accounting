import { X } from 'lucide-react';

export interface InvoiceLineItemData {
  id?: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate_id: string | null;
  tax_amount: number;
  line_total: number;
}

interface InvoiceLineItemProps {
  line: InvoiceLineItemData;
  index: number;
  items: Array<{ id: string; name: string; sales_price: number }>;
  taxRates: Array<{ id: string; name: string; rate: number }>;
  onUpdate: (index: number, line: InvoiceLineItemData) => void;
  onRemove: (index: number) => void;
}

export function InvoiceLineItem({ line, index, items, taxRates, onUpdate, onRemove }: InvoiceLineItemProps) {
  const handleItemChange = (itemId: string) => {
    const selectedItem = items.find(i => i.id === itemId);
    if (selectedItem) {
      const updatedLine = {
        ...line,
        item_id: itemId,
        description: selectedItem.name,
        unit_price: selectedItem.sales_price,
      };
      calculateTotals(updatedLine);
    }
  };

  const calculateTotals = (updatedLine: InvoiceLineItemData) => {
    const subtotal = updatedLine.quantity * updatedLine.unit_price;
    const discountAmount = subtotal * (updatedLine.discount_percent / 100);
    const afterDiscount = subtotal - discountAmount;

    let taxAmount = 0;
    if (updatedLine.tax_rate_id) {
      const taxRate = taxRates.find(t => t.id === updatedLine.tax_rate_id);
      if (taxRate) {
        taxAmount = afterDiscount * (taxRate.rate / 100);
      }
    }

    updatedLine.tax_amount = taxAmount;
    updatedLine.line_total = afterDiscount + taxAmount;

    onUpdate(index, updatedLine);
  };

  return (
    <tr className="border-b border-slate-200">
      <td className="px-4 py-3">
        <select
          value={line.item_id || ''}
          onChange={(e) => handleItemChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={line.description}
          onChange={(e) => {
            const updatedLine = { ...line, description: e.target.value };
            onUpdate(index, updatedLine);
          }}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Description"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          value={line.quantity}
          onChange={(e) => {
            const updatedLine = { ...line, quantity: parseFloat(e.target.value) || 0 };
            calculateTotals(updatedLine);
          }}
          className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          value={line.unit_price}
          onChange={(e) => {
            const updatedLine = { ...line, unit_price: parseFloat(e.target.value) || 0 };
            calculateTotals(updatedLine);
          }}
          className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          value={line.discount_percent}
          onChange={(e) => {
            const updatedLine = { ...line, discount_percent: parseFloat(e.target.value) || 0 };
            calculateTotals(updatedLine);
          }}
          className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={line.tax_rate_id || ''}
          onChange={(e) => {
            const updatedLine = { ...line, tax_rate_id: e.target.value || null };
            calculateTotals(updatedLine);
          }}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No tax</option>
          {taxRates.map((tax) => (
            <option key={tax.id} value={tax.id}>
              {tax.name} ({tax.rate}%)
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right font-medium text-slate-900">
        {line.line_total.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"
        >
          <X className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
