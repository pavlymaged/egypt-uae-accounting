import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface FieldProps {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  optional?: boolean;
  children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode;
}

export function Field({ label, error, hint, optional, children }: FieldProps) {
  const id = useId();
  const { t } = useI18n();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink-800">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-400">{t('common.optional')}</span>}
      </label>
      {children(id, describedBy, Boolean(error))}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const baseInput =
  'block h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-ink-50 disabled:text-ink-500';

export function inputClass(invalid: boolean) {
  return `${baseInput} ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-ink-200 hover:border-ink-300 focus:border-brand-500 focus:ring-brand-100'}`;
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid = false, className = '', ...rest }: TextInputProps) {
  return <input {...rest} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} ${className}`} />;
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid = false, className = '', rows = 3, ...rest }: TextAreaProps) {
  return <textarea {...rest} rows={rows} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} h-auto resize-y py-2 ${className}`} />;
}

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function SelectInput({ invalid = false, className = '', children, ...rest }: SelectInputProps) {
  return (
    <select {...rest} aria-invalid={invalid || undefined} className={`${inputClass(invalid)} pe-8 ${className}`}>
      {children}
    </select>
  );
}

export function PasswordInput({ invalid = false, ...rest }: TextInputProps) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <TextInput {...rest} invalid={invalid} type={visible ? 'text' : 'password'} className="pe-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('login.hide') : t('login.show')}
        title={visible ? t('login.hide') : t('login.show')}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-lg text-ink-400 transition-colors hover:text-ink-700 focus:outline-none focus-visible:text-brand-700"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}

export function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${checked ? 'bg-brand-600' : 'bg-ink-300'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'ltr:translate-x-[22px] rtl:-translate-x-[22px]' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'}`}
        />
      </button>
    </label>
  );
}
