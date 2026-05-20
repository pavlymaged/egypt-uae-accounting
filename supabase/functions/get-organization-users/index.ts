import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('=== Starting get-organization-users function ===');
    
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
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    console.log('User auth result:', { userId: user?.id, error: authError?.message });

    if (authError || !user) {
      throw new Error("Unauthorized: " + (authError?.message || "No user found"));
    }

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body:', requestBody);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      throw new Error("Invalid request body");
    }

    const { organizationId } = requestBody;

    if (!organizationId) {
      throw new Error("Missing organizationId parameter");
    }

    console.log('Checking user role for org:', organizationId);

    const { data: userRole, error: userRoleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    console.log('User role result:', { role: userRole?.role, error: userRoleError?.message });

    if (userRoleError) {
      throw new Error(`Failed to verify organization access: ${userRoleError.message}`);
    }

    if (!userRole) {
      throw new Error("You do not have access to this organization");
    }

    if (userRole.role !== "super_admin") {
      throw new Error("You do not have permission to view users");
    }

    console.log('Fetching all users for org:', organizationId);

    const { data: userRoles, error: fetchError } = await supabaseClient
      .from("user_roles")
      .select("*")
      .eq("organization_id", organizationId);

    console.log('Fetched user roles:', { count: userRoles?.length, error: fetchError?.message });

    if (fetchError) {
      throw fetchError;
    }

    console.log('Fetching email addresses for users...');

    const usersWithEmails = await Promise.all(
      (userRoles || []).map(async (userRole) => {
        try {
          const { data: authUser, error: userError } = await supabaseClient.auth.admin.getUserById(
            userRole.user_id
          );

          if (userError) {
            console.warn(`Failed to get user ${userRole.user_id}:`, userError.message);
            return {
              ...userRole,
              email: "Unknown",
            };
          }

          return {
            ...userRole,
            email: authUser.user?.email || "Unknown",
          };
        } catch (err) {
          console.error(`Error processing user ${userRole.user_id}:`, err);
          return {
            ...userRole,
            email: "Unknown",
          };
        }
      })
    );

    console.log('Successfully prepared response with', usersWithEmails.length, 'users');

    return new Response(
      JSON.stringify({ users: usersWithEmails }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Error in get-organization-users:", err);
    console.error('Error stack:', err.stack);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to fetch users",
        details: err.stack,
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