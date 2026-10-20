import type { PostgrestError } from '@supabase/supabase-js';

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message);
}

export function isUniqueViolation(error: PostgrestError | null, constraint?: string): boolean {
  if (!error) return false;
  if (error.code !== '23505') return false;
  if (!constraint) return true;
  return `${error.message} ${error.details ?? ''}`.includes(constraint);
}

export function isLastSuperAdminError(error: { message?: string } | null): boolean {
  return Boolean(error?.message && /at least one active super admin/i.test(error.message));
}
