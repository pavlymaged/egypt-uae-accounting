import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n/en';
import { supabase } from './supabase';

export type InviteResult =
  | { ok: true; userId: string }
  | { ok: false; code: string; field?: string; message?: string };

export async function sendInvite(fn: 'invite-staff' | 'invite-company-user', body: Record<string, unknown>): Promise<InviteResult> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body: { ...body, redirect_to: `${window.location.origin}/set-password` },
  });

  if (error) {
    if (error instanceof FunctionsFetchError) return { ok: false, code: 'network' };
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as { error?: { code?: unknown; field?: unknown; message?: unknown } };
        const e = payload.error;
        if (e && typeof e.code === 'string') {
          return {
            ok: false,
            code: e.code,
            field: typeof e.field === 'string' ? e.field : undefined,
            message: typeof e.message === 'string' ? e.message : undefined,
          };
        }
      } catch {
        return { ok: false, code: 'unexpected' };
      }
    }
    return { ok: false, code: 'unexpected' };
  }

  if (data && typeof data === 'object' && typeof (data as { user_id?: unknown }).user_id === 'string') {
    return { ok: true, userId: (data as { user_id: string }).user_id };
  }
  return { ok: false, code: 'unexpected' };
}

export interface InviteProblem {
  field: 'email' | 'full_name' | 'role' | 'joining_date' | null;
  key: TranslationKey;
  vars?: Record<string, string>;
}

export function describeInviteFailure(result: Extract<InviteResult, { ok: false }>): InviteProblem {
  switch (result.code) {
    case 'email_exists':
      return { field: 'email', key: 'invite.emailExists' };
    case 'invalid_email':
      return { field: 'email', key: 'invite.emailInvalid' };
    case 'invalid_full_name':
      return { field: 'full_name', key: 'invite.nameInvalid' };
    case 'invalid_role':
      return { field: 'role', key: 'invite.roleRequired' };
    case 'invalid_date':
      return { field: 'joining_date', key: 'invite.dateInvalid' };
    case 'not_found':
      return { field: null, key: 'invite.notFound' };
    case 'network':
      return { field: null, key: 'common.networkError' };
    case 'insert_failed':
      return { field: null, key: 'invite.saveFailed', vars: { msg: result.message ?? '' } };
    case 'invite_failed':
      return { field: null, key: 'invite.sendFailed' };
    default:
      return { field: null, key: 'common.unexpected' };
  }
}
