import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateClientUserRequest {
  email: string;
  password: string;
  customerId: string;
  organizationId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { email, password, customerId, organizationId }: CreateClientUserRequest = await req.json();
    if (!email || !password || !customerId || !organizationId) {
      throw new Error("Missing required fields: email, password, customerId, organizationId");
    }

    // Verify caller is admin/owner in the org
    const { data: callerRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!callerRole || !["super_admin", "owner", "admin"].includes(callerRole.role)) {
      throw new Error("Permission denied: only admins can assign client credentials");
    }

    // Check if client already has a portal user
    const { data: existing } = await supabaseClient
      .from("client_portal_users")
      .select("id, user_id, email")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existing) {
      // Update existing user's email/password
      const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
        existing.user_id,
        { email, password, email_confirm: true }
      );
      if (updateError) throw new Error(`Failed to update credentials: ${updateError.message}`);

      await supabaseClient
        .from("client_portal_users")
        .update({ email, is_active: true })
        .eq("id", existing.id);

      return new Response(
        JSON.stringify({ success: true, message: "Client credentials updated", userId: existing.user_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new auth user for the client
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw new Error(`Failed to create user: ${createError.message}`);
    if (!newUser.user) throw new Error("Failed to create user: no user returned");

    // Link to client_portal_users
    const { error: linkError } = await supabaseClient
      .from("client_portal_users")
      .insert({
        customer_id: customerId,
        user_id: newUser.user.id,
        organization_id: organizationId,
        email,
        is_active: true,
        created_by: user.id,
      });

    if (linkError) {
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to link client user: ${linkError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Client credentials created", userId: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in create-client-user:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create client user" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
