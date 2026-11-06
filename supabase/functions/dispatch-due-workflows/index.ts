import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type ClaimedWorkflow = {
  id: string;
  workflow_id: string | null;
  owner_wallet: string;
  name: string;
  workflow_json: Record<string, unknown>;
  schedule: string;
  execution_mode: string;
  schedule_seconds: number;
  scheduled_for: string;
  next_run_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    return json({ error: "CRON_SECRET is not configured" }, 503);
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing Supabase server configuration" }, 503);
  }

  const sb = createClient(supabaseUrl, serviceKey);

  const { data: claimed, error: claimError } = await sb.rpc("claim_due_workflows", {
    p_limit: 20,
    p_worker: "supabase-cron",
  });

  if (claimError) {
    console.error("claim_due_workflows failed", claimError);
    return json({ error: claimError.message }, 500);
  }

  const rows = (claimed || []) as ClaimedWorkflow[];
  const results: Array<{
    id: string;
    name: string;
    status: string;
    error?: string;
  }> = [];

  for (const row of rows) {
    let status = "executed";
    let errorMessage: string | null = null;
    let output: unknown = null;

    try {
      if (!row.workflow_json || typeof row.workflow_json !== "object") {
        throw new Error("Workflow JSON is missing");
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/run-workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          workflow: row.workflow_json,
          workflowId: row.id,
          executionMode: row.execution_mode,
          notifyOnly: row.execution_mode === "notify" || row.execution_mode === "manual",
          scheduledFor: row.scheduled_for,
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(responseText || `run-workflow returned ${response.status}`);
      }

      output = responseText ? JSON.parse(responseText) : null;
      if (output && typeof output === "object" && "triggered" in output && output.triggered === false) {
        status = "skipped";
      }
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await sb.rpc("finish_workflow_run", {
      p_id: row.id,
      p_status: status,
      p_error: errorMessage,
    });

    const { error: executionError } = await sb
      .from("workflow_executions")
      .upsert(
        {
          workflow_id: row.id,
          scheduled_for: row.scheduled_for,
          status,
          error: errorMessage,
          logs: output,
          finished_at: new Date().toISOString(),
        },
        { onConflict: "workflow_id,scheduled_for" },
      );

    if (executionError) {
      console.error("workflow_executions upsert failed", executionError);
    }

    results.push({ id: row.id, name: row.name, status, error: errorMessage ?? undefined });
  }

  return json({
    ok: true,
    claimed: rows.length,
    results,
  });
});
