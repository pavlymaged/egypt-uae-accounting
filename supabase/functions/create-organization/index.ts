import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateOrganizationRequest {
  name: string;
  country: 'Egypt' | 'UAE';
  base_currency: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  vat_registration_number?: string;
  tax_registration_number?: string;
  fiscal_year_start_month: number;
  default_vat_rate: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[create-organization] Request received");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[create-organization] Missing authorization header");
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[create-organization] Token extracted, length:", token.length);

    const serviceRoleClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[create-organization] Verifying user token...");
    const { data: { user }, error: authError } = await serviceRoleClient.auth.getUser(token);

    if (authError) {
      console.error("[create-organization] Auth error:", authError.message);
      throw new Error("Unauthorized: " + authError.message);
    }

    if (!user) {
      console.error("[create-organization] No user found");
      throw new Error("Unauthorized: No user found");
    }

    console.log("[create-organization] User verified:", user.id);

    const formData: CreateOrganizationRequest = await req.json();
    console.log("[create-organization] Form data received:", {
      name: formData.name,
      country: formData.country,
      base_currency: formData.base_currency
    });

    if (!formData.name || !formData.country) {
      console.error("[create-organization] Missing required fields");
      throw new Error("Missing required fields: name and country");
    }

    console.log("[create-organization] Inserting organization...");
    const { data: org, error: orgError } = await serviceRoleClient
      .from("organizations")
      .insert([formData])
      .select()
      .single();

    if (orgError) {
      console.error("[create-organization] Organization insert error:", orgError);
      throw new Error(`Failed to create organization: ${orgError.message}`);
    }

    if (!org) {
      console.error("[create-organization] No organization returned");
      throw new Error("Failed to create organization: No organization returned");
    }

    console.log("[create-organization] Organization created:", org.id);

    console.log("[create-organization] Assigning user role...");
    const { error: roleError } = await serviceRoleClient
      .from("user_roles")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "super_admin",
        login_enabled: true,
        permissions: {},
      });

    if (roleError) {
      console.error("[create-organization] Role assignment error:", roleError);
      console.log("[create-organization] Rolling back organization...");
      await serviceRoleClient
        .from("organizations")
        .delete()
        .eq("id", org.id);
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    console.log("[create-organization] Success! Organization:", org.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Organization created successfully",
        organizationId: org.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Error in create-organization:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to create organization",
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
