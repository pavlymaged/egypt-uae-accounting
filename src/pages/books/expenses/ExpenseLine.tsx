import { AlertTriangle, CheckCircle2, Copy, Loader2, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { SelectInput, TextInput } from '../../../components/ui/Field';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatNumber } from '../../../lib/money';
import type { Currency } from '../../../types';
import type { CashAccount, Project } from '../books';
import { fieldOfError, type CostCentre, type ItemCode, type LineCheck, type LineDraft, type LineField } from './expenses';
import { ItemCodePicker } from './ItemCodePicker';

export interface LineContext {
  projects: Project[];
  accounts: CashAccount[];
  accountById: Map<string, CashAccount>;
  projectById: Map<string, Project>;
  centres: CostCentre[];
  items: ItemCode[];
  base: Currency;
  companyName: string;
}

interface Props {
  ctx: LineContext;
  line: LineDraft;
  index: number;
  check: LineCheck | undefined;
  saveError: string | undefined;
  checking: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
  onCopy: () => void;
}

function useLineParts({ ctx, line, check, saveError, onChange }: Props) {
  const { t, lang } = useI18n();
  const message = saveError ?? check?.error ?? null;
  const badField: LineField | null = fieldOfError(message);
  const bad = (f: LineField) => badField === f;
  const project = ctx.projectById.get(line.project_id);
  const account = ctx.accountById.get(line.account_id);
  const rateNeeded = !!account && account.currency !== ctx.base;
  const items = project?.is_operation ? ctx.items : ctx.items.filter((i) => i.scope !== 'office' || String(i.code) === line.item_code);

  const chooseProject = (id: string) => {
    const next = ctx.projectById.get(id);
    const item = ctx.items.find((i) => String(i.code) === line.item_code);
    onChange({ project_id: id, ...(next && !next.is_operation && item?.scope === 'office' ? { item_code: '' } : {}) });
  };

  const fields: Record<'date' | 'project' | 'account' | 'category' | 'item' | 'description' | 'amount' | 'rate' | 'return' | 'receipt', ReactNode> = {
    date: <TextInput type="date" dir="ltr" aria-label={t('payments.field.date')} invalid={bad('line_date')} value={line.line_date} onChange={(e) => onChange({ line_date: e.target.value })} />,
    project: (
      <SelectInput aria-label={t('payments.field.project')} invalid={bad('project_id')} value={line.project_id} onChange={(e) => chooseProject(e.target.value)}>
        <option value="">{t('expenses.chooseProject')}</option>
        {ctx.projects.map((p) => (
          <option key={p.id} value={p.id}>{p.is_operation ? t('expenses.operation') : `${p.code} - ${p.name}`}</option>
        ))}
      </SelectInput>
    ),
    account: (
      <SelectInput aria-label={t('expenses.field.account')} invalid={bad('account_id')} value={line.account_id} onChange={(e) => onChange({ account_id: e.target.value })}>
        <option value="">{t('expenses.chooseAccount')}</option>
        {ctx.accounts.map((a) => (
          <option key={a.id} value={a.id}>{`${a.name} (${a.currency})`}</option>
        ))}
      </SelectInput>
    ),
    category: (
      <SelectInput aria-label={t('expenses.field.category')} invalid={bad('category')} value={line.category} onChange={(e) => onChange({ category: e.target.value })}>
        <option value="">-</option>
        {ctx.centres.map((c) => (
          <option key={c.code} value={c.code}>{`${c.code} · ${lang === 'ar' ? c.name_ar : c.name_en}`}</option>
        ))}
      </SelectInput>
    ),
    item: <ItemCodePicker aria-label={t('expenses.field.item')} items={items} invalid={bad('item_code')} value={line.item_code} onChange={(code) => onChange({ item_code: code })} />,
    description: <TextInput dir="auto" aria-label={t('expenses.field.description')} invalid={bad('description')} value={line.description} maxLength={500} onChange={(e) => onChange({ description: e.target.value })} />,
    amount: (
      <div className="relative">
        <TextInput dir="ltr" inputMode="decimal" aria-label={t('payments.field.amount')} invalid={bad('amount')} value={line.amount} onChange={(e) => onChange({ amount: e.target.value })} className="pe-12 text-end tabular-nums" placeholder="0.00" />
        {account && <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-400">{account.currency}</span>}
      </div>
    ),
    rate: rateNeeded ? (
      <TextInput dir="ltr" inputMode="decimal" aria-label={t('payments.field.rate')} invalid={bad('rate')} value={line.rate} onChange={(e) => onChange({ rate: e.target.value })} placeholder={`1 ${account.currency} = ? ${ctx.base}`} className="tabular-nums" />
    ) : (
      <span className="block px-1 text-sm text-ink-300">-</span>
    ),
    return: (
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" checked={line.is_return} onChange={(e) => onChange({ is_return: e.target.checked })} />
        {t('expenses.field.returnShort')}
      </label>
    ),
    receipt: <TextInput dir="ltr" type="url" aria-label={t('expenses.field.receipt')} invalid={bad('receipt_link')} value={line.receipt_link} onChange={(e) => onChange({ receipt_link: e.target.value })} placeholder="https://" />,
  };

  const charge = project && (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${project.is_operation ? 'bg-ink-100 text-ink-700' : 'bg-sky-50 text-sky-800'}`}>
      {project.is_operation ? t('expenses.companyCost', { company: ctx.companyName }) : t('expenses.chargedToClient')}
    </span>
  );

  return { fields, charge, message, rateNeeded, account };
}

export function LineStatus({ props, message }: { props: Props; message: string | null }) {
  const { t } = useI18n();
  const { check, checking, line, ctx, onChange } = props;
  const account = ctx.accountById.get(line.account_id);
  if (message) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span dir="auto">{message}</span>
      </p>
    );
  }
  if (!check) return checking ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" aria-label={t('expenses.checking')} /> : null;
  const base =
    account && account.currency !== ctx.base && check.base_amount ? (
      <span dir="ltr" className="tabular-nums text-ink-600">{`= ${formatNumber(check.base_amount, ctx.base)} ${ctx.base}`}</span>
    ) : null;
  if (check.is_duplicate) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          {t('expenses.dupWarning')}
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
          <input type="checkbox" className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500" checked={line.confirm_duplicate} onChange={(e) => onChange({ confirm_duplicate: e.target.checked })} />
          {t('expenses.notDuplicate')}
        </label>
        {base}
      </div>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-emerald-700">
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-label={t('expenses.lineOk')} />
      {base}
    </p>
  );
}

export function LineButtons({ canRemove, onRemove, onCopy, index }: Pick<Props, 'canRemove' | 'onRemove' | 'onCopy' | 'index'>) {
  const { t } = useI18n();
  const cls = 'rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={cls} onClick={onCopy} title={t('expenses.copyLine')} aria-label={`${t('expenses.copyLine')} ${index + 1}`}>
        <Copy className="h-4 w-4" />
      </button>
      <button type="button" className={`${cls} hover:text-red-700`} disabled={!canRemove} onClick={onRemove} title={t('expenses.removeLine')} aria-label={`${t('expenses.removeLine')} ${index + 1}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function LineRow(props: Props) {
  const { fields, charge, message } = useLineParts(props);
  const hasStatus = !!message || !!props.check || props.checking;
  const cell = 'px-1.5 py-2 align-top';
  return (
    <>
      <tr className={`group ${props.index % 2 ? 'bg-ink-50/40' : 'bg-white'}`}>
        <td className={`${cell} ps-3 pt-4 text-xs font-medium tabular-nums text-ink-400`}>{props.index + 1}</td>
        <td className={`${cell} w-40`}>{fields.date}</td>
        <td className={`${cell} w-56`}>
          {fields.project}
          <div className="mt-1 min-h-[1.25rem]">{charge}</div>
        </td>
        <td className={`${cell} w-48`}>{fields.account}</td>
        <td className={`${cell} w-40`}>{fields.category}</td>
        <td className={`${cell} w-60`}>{fields.item}</td>
        <td className={`${cell} min-w-[14rem]`}>{fields.description}</td>
        <td className={`${cell} w-36`}>{fields.amount}</td>
        <td className={`${cell} w-36`}>{fields.rate}</td>
        <td className={`${cell} pt-4`}>{fields.return}</td>
        <td className={`${cell} w-48`}>{fields.receipt}</td>
        <td className={`${cell} pe-3 pt-3`}><LineButtons {...props} /></td>
      </tr>
      {hasStatus && (
        <tr className={props.index % 2 ? 'bg-ink-50/40' : 'bg-white'}>
          <td />
          <td colSpan={11} className="px-1.5 pb-3">
            <LineStatus props={props} message={message} />
          </td>
        </tr>
      )}
    </>
  );
}

export function LineCard(props: Props) {
  const { t } = useI18n();
  const { fields, charge, message } = useLineParts(props);
  const label = (text: string, node: ReactNode, wide = false) => (
    <label className={`block space-y-1 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-xs font-medium text-ink-500">{text}</span>
      {node}
    </label>
  );
  return (
    <li className="space-y-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900">{t('expenses.lineNo', { n: props.index + 1 })}</span>
          {charge}
        </div>
        <LineButtons {...props} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {label(t('payments.field.date'), fields.date)}
        {label(t('payments.field.amount'), fields.amount)}
        {label(t('payments.field.project'), fields.project, true)}
        {label(t('expenses.field.account'), fields.account, true)}
        {label(t('expenses.field.category'), fields.category)}
        {props.ctx.accountById.get(props.line.account_id)?.currency !== props.ctx.base && props.line.account_id ? label(t('payments.field.rate'), fields.rate) : <div />}
        <div className="col-span-2 space-y-1">
          <span className="text-xs font-medium text-ink-500">{t('expenses.field.item')}</span>
          {fields.item}
        </div>
        {label(t('expenses.field.description'), fields.description, true)}
        {label(t('expenses.field.receipt'), fields.receipt, true)}
        <div className="col-span-2">{fields.return}</div>
      </div>
      <LineStatus props={props} message={message} />
    </li>
  );
}
