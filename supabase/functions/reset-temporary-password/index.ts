import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fail(status: number, code: string, message: string) {
  return reply(status, { error: { code, message } });
}

function generatePassword(length = 16): string {
  const limit = 256 - (256 % ALPHABET.length);
  const out: string[] = [];
  const buf = new Uint8Array(32);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method", "Use POST.");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail(404, "not_found", "Not found");

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail(400, "invalid_body", "The request could not be read.");
    }

    const userId = typeof body.user_id === "string" ? body.user_id : "";
    if (!UUID_RE.test(userId)) return fail(404, "not_found", "Not found");

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: allowed, error: checkError } = await userClient.rpc("can_reset_password", { p_user: userId });
    if (checkError || allowed !== true) return fail(404, "not_found", "Not found");

    const { error: logError } = await userClient.rpc("log_password_reset", { p_user: userId });
    if (logError) return fail(400, "log_failed", "The reset could not be recorded, so nothing was changed. Please try again.");

    const { data: existing, error: readError } = await adminClient.auth.admin.getUserById(userId);
    if (readError || !existing?.user) return fail(404, "not_found", "Not found");

    const temporaryPassword = generatePassword();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      app_metadata: { ...(existing.user.app_metadata ?? {}), must_change_password: true },
    });
    if (updateError) return fail(502, "update_failed", "The password could not be reset. Please try again.");

    return reply(200, { temporary_password: temporaryPassword });
  } catch {
    return fail(500, "unexpected", "Something went wrong. Please try again.");
  }
});
