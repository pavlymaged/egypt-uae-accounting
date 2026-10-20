import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fail(status: number, code: string, message: string) {
  return reply(status, { error: { code, message } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method", "Use POST.");

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!authHeader || !token) return fail(404, "not_found", "Not found");

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail(400, "invalid_body", "The request could not be read.");
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: caller, error: userError } = await userClient.auth.getUser(token);
    if (userError || !caller?.user) return fail(404, "not_found", "Not found");
    const user = caller.user;

    if (user.app_metadata?.must_change_password !== true) {
      return fail(400, "not_pending", "No password change is pending.");
    }

    const newPassword = body.new_password;
    if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 72) {
      return fail(400, "invalid_password", "New password: use 12 to 72 characters.");
    }

    const adminClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword,
      app_metadata: { ...user.app_metadata, must_change_password: false },
    });
    if (updateError) {
      if (updateError.code === "weak_password") return fail(400, "weak_password", "New password: this password is too weak.");
      if (updateError.code === "same_password") return fail(400, "same_password", "New password: choose a different password.");
      return fail(502, "update_failed", "The password could not be changed. Please try again.");
    }

    return reply(200, { ok: true });
  } catch {
    return fail(500, "unexpected", "Something went wrong. Please try again.");
  }
});
