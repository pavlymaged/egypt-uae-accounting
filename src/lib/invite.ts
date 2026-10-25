import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n/en';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type AccessMethod = 'temporary_password' | 'invite';

type Failure = { ok: false; code: string; field?: string; message?: string };
type CallResult = { ok: true; data: Record<string, unknown> } | Failure;

export type InviteResult = { ok: true; userId: string; temporaryPassword: string | null } | Failure;
export type ResetResult = { ok: true; temporaryPassword: string } | Failure;
export type ChangeResult = { ok: true } | Failure;

type FunctionName = 'invite-staff' | 'invite-company-user' | 'reset-temporary-password' | 'change-initial-password';

async function callFunction(fn: FunctionName, body: Record<string, unknown>): Promise<CallResult> {
  const { data, error } = await supabase.functions.invoke(fn, { body });

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

  if (data && typeof data === 'object') return { ok: true, data: data as Record<string, unknown> };
  return { ok: false, code: 'unexpected' };
}

export async function sendInvite(
  fn: 'invite-staff' | 'invite-company-user',
  method: AccessMethod,
  body: Record<string, unknown>,
): Promise<InviteResult> {
  const result = await callFunction(fn, {
    ...body,
    method,
    redirect_to: method === 'invite' ? `${window.location.origin}/set-password` : undefined,
  });
  if (!result.ok) return result;
  const { user_id: userId, temporary_password: password } = result.data;
  if (typeof userId !== 'string') return { ok: false, code: 'unexpected' };
  if (method === 'temporary_password') {
    if (typeof password !== 'string') return { ok: false, code: 'unexpected' };
    return { ok: true, userId, temporaryPassword: password };
  }
  return { ok: true, userId, temporaryPassword: null };
}

export async function resetTemporaryPassword(userId: string): Promise<ResetResult> {
  const result = await callFunction('reset-temporary-password', { user_id: userId });
  if (!result.ok) return result;
  const password = result.data.temporary_password;
  return typeof password === 'string' ? { ok: true, temporaryPassword: password } : { ok: false, code: 'unexpected' };
}

const CHANGE_TIMEOUT_MS = 20_000;

// Direct fetch: functions.invoke cannot be aborted in this library version and waits on the auth lock first.
export async function changeInitialPassword(newPassword: string, accessToken: string): Promise<ChangeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHANGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/change-initial-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ new_password: newPassword }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = (await res.json().catch(() => null)) as
      | { ok?: unknown; error?: { code?: unknown } }
      | null;
    if (res.ok) return payload?.ok === true ? { ok: true } : { ok: false, code: 'unexpected' };
    const code = payload?.error?.code;
    return { ok: false, code: typeof code === 'string' ? code : 'unexpected' };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, code: 'timeout' };
    return { ok: false, code: err instanceof TypeError ? 'network' : 'unexpected' };
  } finally {
    clearTimeout(timer);
  }
}

export interface InviteProblem {
  field: 'email' | 'full_name' | 'role' | 'joining_date' | null;
  key: TranslationKey;
  vars?: Record<string, string>;
}

export function describeInviteFailure(result: Failure): InviteProblem {
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
    case 'create_failed':
      return { field: null, key: 'invite.createFailed' };
    default:
      return { field: null, key: 'common.unexpected' };
  }
}
