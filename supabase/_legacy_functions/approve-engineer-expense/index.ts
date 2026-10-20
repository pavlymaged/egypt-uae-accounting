import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { expense_id, accountant_notes, organization_id, reviewer_id } = await req.json();

    if (!expense_id || !organization_id || !reviewer_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: expense_id, organization_id, reviewer_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: expense, error: fetchError } = await supabase
      .from("engineer_expenses")
      .select("*, engineer:site_engineers(id, name), project:projects(project_code, project_name)")
      .eq("id", expense_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (fetchError || !expense) {
      return new Response(
        JSON.stringify({ error: "Expense not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (expense.status !== "Pending") {
      return new Response(
        JSON.stringify({ error: `Cannot approve expense with status: ${expense.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase
      .from("engineer_expenses")
      .update({
        status: "Approved",
        accountant_notes: accountant_notes || "",
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer_id,
      })
      .eq("id", expense_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update expense: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lastExpense } = await supabase
      .from("project_expenses")
      .select("expense_number")
      .eq("organization_id", organization_id)
      .eq("expense_type", "site")
      .order("created_at", { ascending: false })
      .limit(1);

    let nextNum = "SEXP-0001";
    if (lastExpense && lastExpense.length > 0) {
      const match = lastExpense[0].expense_number.match(/\d+$/);
      if (match) {
        const n = parseInt(match[0]) + 1;
        nextNum = `SEXP-${String(n).padStart(4, "0")}`;
      }
    }

    const { error: insertError } = await supabase
      .from("project_expenses")
      .insert([{
        organization_id,
        expense_number: nextNum,
        project_id: expense.project_id,
        expense_type: "site",
        expense_date: expense.expense_date,
        description: expense.description,
        amount: expense.amount,
        payment_method: "employee_advance",
        category: expense.category.toLowerCase(),
        profession: expense.profession || "",
        tax_included: expense.tax > 0,
        status: "confirmed",
        created_by: reviewer_id,
        reviewed_by: reviewer_id,
        reviewed_at: new Date().toISOString(),
        notes: `Engineer expense (${expense.engineer?.name || "unknown"})`,
      }]);

    if (insertError) {
      await supabase
        .from("engineer_expenses")
        .update({ status: "Pending", reviewed_at: null, reviewed_by: null })
        .eq("id", expense_id);

      return new Response(
        JSON.stringify({ error: `Failed to record in main ledger: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, expense_number: nextNum }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
