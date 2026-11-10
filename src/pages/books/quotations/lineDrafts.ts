import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Currency } from '../../../types';
import type { QuotationLine } from './quotations';

export interface LineDraft {
  key: string;
  description: string;
  link: string;
  qty: string;
  unit: string;
  office_unit: string;
  client_unit: string;
  confirm: boolean;
}

export interface LineCheck {
  line_no: number;
  error: string | null;
  office_total: string | null;
  client_total: string | null;
  commission: string | null;
  client_below_office: boolean | null;
}

export type CheckState = { kind: 'idle' } | { kind: 'checking'; results: Map<number, LineCheck> } | { kind: 'ready'; results: Map<number, LineCheck> } | { kind: 'failed'; error: { message?: string } | null };

const CHECK_COLUMNS = 'line_no, error, office_total:office_total::text, client_total:client_total::text, commission:commission::text, client_below_office';

export const newKey = () => `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const emptyLine = (): LineDraft => ({ key: newKey(), description: '', link: '', qty: '', unit: '', office_unit: '', client_unit: '', confirm: false });

export const fromSaved = (l: QuotationLine): LineDraft => ({
  key: newKey(),
  description: l.description ?? '',
  link: l.link ?? '',
  qty: l.qty ?? '',
  unit: l.unit ?? '',
  office_unit: l.office_unit ?? '',
  client_unit: l.client_unit ?? '',
  confirm: l.confirm_below_office === true,
});

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

function numberText(value: string): string {
  return value
    .replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(/\u066B/g, '.')
    .replace(/[,\u066C\s]/g, '');
}

export function toPayload(lines: LineDraft[], results?: Map<number, LineCheck>) {
  return lines.map((l, i) => {
    const flagged = results?.get(i + 1)?.client_below_office;
    return {
      description: l.description.trim(),
      link: l.link.trim() || null,
      qty: numberText(l.qty),
      unit: l.unit.trim() || null,
      office_unit: numberText(l.office_unit),
      client_unit: numberText(l.client_unit),
      confirm_below_office: l.confirm && flagged !== false,
    };
  });
}

export function useLineCheck(companyId: string, currency: Currency, lines: LineDraft[]): CheckState {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const latest = useRef(0);
  const key = JSON.stringify(toPayload(lines));

  useEffect(() => {
    const payload: unknown[] = JSON.parse(key);
    if (payload.length === 0) {
      setState({ kind: 'idle' });
      return;
    }
    setState((s) => ({ kind: 'checking', results: s.kind === 'ready' || s.kind === 'checking' ? s.results : new Map() }));
    const timer = window.setTimeout(async () => {
      const id = (latest.current += 1);
      const { data, error } = await supabase.rpc('check_quotation_lines', { p_company: companyId, p_currency: currency, p_lines: payload }).select(CHECK_COLUMNS);
      if (id !== latest.current) return;
      if (error || !Array.isArray(data)) return setState({ kind: 'failed', error });
      const rows = data as unknown as LineCheck[];
      setState({ kind: 'ready', results: new Map(rows.map((r) => [r.line_no, r])) });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [key, companyId, currency]);

  return state;
}

export function lineMessages(message: string): { lines: Map<number, string>; rest: string[] } {
  const lines = new Map<number, string>();
  const rest: string[] = [];
  message.split(/\r?\n/).forEach((part) => {
    const match = /^Line (\d+):\s*(.*)$/.exec(part.trim());
    if (match) lines.set(Number(match[1]), match[2]);
    else if (part.trim()) rest.push(part.trim());
  });
  return { lines, rest };
}
