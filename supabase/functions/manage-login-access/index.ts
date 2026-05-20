import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ManageLoginRequest {
  organizationId: string;
  targetUserId: string;
  loginEnabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized: " + (authError?.message || "No user found"));
    }

    const { organizationId, targetUserId, loginEnabled }: ManageLoginRequest = await req.json();

    if (!organizationId || !targetUserId || loginEnabled === undefined) {
      throw new Error("Missing required fields");
    }

    const { data: adminRole, error: adminRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (adminRoleError) {
      throw new Error(`Failed to verify permissions: ${adminRoleError.message}`);
    }

    if (!adminRole || adminRole.role !== "super_admin") {
      throw new Error("You do not have permission to manage login access");
    }

    const { data: targetRole, error: targetRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (targetRoleError || !targetRole) {
      throw new Error("Target user not found in this organization");
    }

    if (targetRole.role === "super_admin") {
      throw new Error("Cannot modify login access for super administrators");
    }

    const { error: updateError } = await supabaseClient
      .from("user_roles")
      .update({ login_enabled: loginEnabled })
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId);

    if (updateError) {
      throw updateError;
    }

    await supabaseClient
      .from("user_management_logs")
      .insert({
        organization_id: organizationId,
        admin_user_id: user.id,
        target_user_id: targetUserId,
        action: loginEnabled ? "login_enabled" : "login_disabled",
        details: {
          login_enabled: loginEnabled,
        },
      });

    return new Response(
      JSON.stringify({ success: true, message: `Login access ${loginEnabled ? "enabled" : "disabled"} successfully` }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Error in manage-login-access:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to manage login access",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});