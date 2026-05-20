import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  password: string;
  organizationId: string;
  role: "super_admin" | "accountant" | "staff";
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

    const { email, password, organizationId, role, loginEnabled }: CreateUserRequest = await req.json();

    if (!email || !password || !organizationId || !role) {
      throw new Error("Missing required fields");
    }

    const { data: creatorRole, error: creatorRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (creatorRoleError) {
      throw new Error(`Failed to verify permissions: ${creatorRoleError.message}`);
    }

    if (!creatorRole || creatorRole.role !== "super_admin") {
      throw new Error("You do not have permission to create users");
    }

    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("Failed to create user: No user returned");
    }

    const finalLoginEnabled = role === "super_admin" ? true : loginEnabled;

    const { error: insertError } = await supabaseClient
      .from("user_roles")
      .insert({
        organization_id: organizationId,
        user_id: newUser.user.id,
        role: role,
        login_enabled: finalLoginEnabled,
        created_by: user.id,
      });

    if (insertError) {
      await supabaseClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Failed to assign role: ${insertError.message}`);
    }

    await supabaseClient
      .from("user_management_logs")
      .insert({
        organization_id: organizationId,
        admin_user_id: user.id,
        target_user_id: newUser.user.id,
        action: "user_created",
        details: {
          email: email,
          role: role,
          login_enabled: finalLoginEnabled,
        },
      });

    return new Response(
      JSON.stringify({ success: true, message: "User created successfully", userId: newUser.user.id }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Error in create-user:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to create user",
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