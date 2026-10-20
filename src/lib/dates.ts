import type { Lang } from '../i18n/I18nProvider';

export function formatDate(value: string | null | undefined, lang: Lang): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return value;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function ageFromBirthDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}
