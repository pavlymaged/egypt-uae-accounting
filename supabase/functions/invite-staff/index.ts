import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF_ROLES = ["super_admin", "accounting_manager", "checker", "accountant"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
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

function fail(status: number, code: string, message: string, field?: string) {
  return reply(status, { error: { code, message, field } });
}

function isExistingAccount(err: { code?: string; status?: number; message?: string }) {
  return err.code === "email_exists" || err.code === "user_already_exists" ||
    /already (been )?registered|already exists/i.test(err.message ?? "");
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

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const staffRole = typeof body.staff_role === "string" ? body.staff_role : "";
    const positionTitle = typeof body.position_title === "string" ? body.position_title.trim() : "";
    const joiningDate = typeof body.joining_date === "string" ? body.joining_date.trim() : "";
    const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;
    const method = body.method === undefined ? "invite" : body.method;

    if (method !== "invite" && method !== "temporary_password") {
      return fail(400, "invalid_method", "Access method: choose one of the listed options.");
    }

    if (!email || !EMAIL_RE.test(email) || email.length > 320) {
      return fail(400, "invalid_email", "Email: enter a valid email address, like name@example.com.", "email");
    }
    if (!fullName) return fail(400, "invalid_full_name", "Full name: enter the person's name.", "full_name");
    if (fullName.length > 200) {
      return fail(400, "invalid_full_name", "Full name: use at most 200 characters.", "full_name");
    }
    if (!STAFF_ROLES.includes(staffRole)) {
      return fail(400, "invalid_role", "Role: choose one of the listed roles.", "staff_role");
    }
    if (positionTitle.length > 200) {
      return fail(400, "invalid_position", "Position title: use at most 200 characters.", "position_title");
    }
    if (joiningDate && (!DATE_RE.test(joiningDate) || Number.isNaN(Date.parse(joiningDate)))) {
      return fail(400, "invalid_date", "Joining date: pick a valid date.", "joining_date");
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: allowed, error: checkError } = await userClient.rpc("can_invite_staff", { p_role: staffRole });
    if (checkError || allowed !== true) return fail(404, "not_found", "Not found");

    const temporaryPassword = method === "temporary_password" ? generatePassword() : null;
    const { data: created, error: createError } = temporaryPassword
      ? await adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { must_change_password: true },
      })
      : await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName },
      });
    if (createError || !created?.user) {
      if (createError && isExistingAccount(createError)) {
        return fail(409, "email_exists", "This email already has an account. Adding existing accounts is not available yet.", "email");
      }
      return temporaryPassword
        ? fail(502, "create_failed", "The login could not be created. Please try again.")
        : fail(502, "invite_failed", "The invitation could not be sent. Please try again.");
    }

    const userId = created.user.id;
    const { error: insertError } = await userClient.from("staff_members").insert({
      user_id: userId,
      full_name: fullName,
      email,
      staff_role: staffRole,
      position_title: positionTitle || null,
      joining_date: joiningDate || null,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(userId);
      return fail(400, "insert_failed", `The staff record could not be saved: ${insertError.message}`);
    }

    return reply(200, temporaryPassword ? { user_id: userId, temporary_password: temporaryPassword } : { user_id: userId });
  } catch {
    return fail(500, "unexpected", "Something went wrong. Please try again.");
  }
});
