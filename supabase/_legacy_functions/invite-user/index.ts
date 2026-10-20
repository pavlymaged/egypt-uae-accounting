import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteRequest {
  email: string;
  organizationId: string;
  role: "super_admin" | "accountant" | "staff";
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

    const { email, organizationId, role }: InviteRequest = await req.json();

    if (!email || !organizationId || !role) {
      throw new Error("Missing required fields");
    }

    const { data: inviterRole, error: inviterRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (inviterRoleError) {
      throw new Error(`Failed to verify permissions: ${inviterRoleError.message}`);
    }

    if (!inviterRole || inviterRole.role !== "super_admin") {
      throw new Error("You do not have permission to invite users");
    }

    const { data: targetUserData, error: getUserError } = await supabaseClient
      .rpc("get_user_id_by_email", { user_email: email });

    if (getUserError) {
      return new Response(
        JSON.stringify({ error: "User must first register with this email address before being invited" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!targetUserData || targetUserData.length === 0) {
      return new Response(
        JSON.stringify({ error: "User must first register with this email address before being invited" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const targetUserId = targetUserData[0].id;

    const { data: existingRole } = await supabaseClient
      .from("user_roles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existingRole) {
      return new Response(
        JSON.stringify({ error: "User is already a member of this organization" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const loginEnabled = role === "super_admin" ? true : false;

    const { error: insertError } = await supabaseClient
      .from("user_roles")
      .insert({
        organization_id: organizationId,
        user_id: targetUserId,
        role: role,
        login_enabled: loginEnabled,
        created_by: user.id,
      });

    if (insertError) {
      throw insertError;
    }

    await supabaseClient
      .from("user_management_logs")
      .insert({
        organization_id: organizationId,
        admin_user_id: user.id,
        target_user_id: targetUserId,
        action: "user_invited",
        details: {
          email: email,
          role: role,
          login_enabled: loginEnabled,
        },
      });

    return new Response(
      JSON.stringify({ success: true, message: "User invited successfully" }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Error in invite-user:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to invite user",
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