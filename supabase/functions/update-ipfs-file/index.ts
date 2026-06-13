import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request payload
    const { id, name, json } = await req.json();

    // Basic payload validation
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing required workflow identifier (id)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'name'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!json || typeof json !== "object") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'json' payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const PINATA_JWT = Deno.env.get("PINATA_JWT");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing required workflow identifier (id)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Safe lookup structure to protect against PostgreSQL column mismatches or syntax aborts
    let oldWorkflow = null;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const { data } = await supabase
          .from("workflows")
          .select("id, pinata_file_id")
          .eq("id", id)
          .maybeSingle();
        oldWorkflow = data;
      } else {
        const { data } = await supabase
          .from("workflows")
          .select("id, pinata_file_id")
          .eq("pinata_file_id", id)
          .maybeSingle();
        oldWorkflow = data;
      }
    } catch (dbErr: any) {
      console.error("[DB WARNING] Fallback searching workflow keys skipped:", dbErr.message);
    }

    // If we could not locate the workflow, abort with 404
    if (!oldWorkflow) {
      console.warn(`[UPDATE] Workflow not found for identifier ${id}`);
      return new Response(JSON.stringify({ error: "Workflow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the definitive DB row identifier (always the internal UUID)
    const dbRowId = oldWorkflow.id;

    // 1. Upload the updated JSON payload to Pinata IPFS network
    const pinataPostRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataMetadata: { name: name || "solflows-workflow" },
        pinataOptions: { groupId: Deno.env.get("PINATA_GROUP_ID") },
      }),
    });

    if (!pinataPostRes.ok) {
      const errText = await pinataPostRes.text();
      console.error(`[PINATA] Pin failed: ${pinataPostRes.status} ${errText}`);
      throw new Error(`Pinata error: ${pinataPostRes.status} ${errText}`);
    }
    
    const postData = await pinataPostRes.json();
    const newCid = postData.IpfsHash;
    let newPinataId = postData.id || postData.data?.id;

    // Fallback mechanism to recover the V7 File ID if missing from the direct response
    if (!newPinataId) {
      try {
        const listRes = await fetch(`https://api.pinata.cloud/v3/files/public?search=${name || "solflows-workflow"}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${PINATA_JWT}` }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const matchingFile = listData.data?.files?.find((f: any) => f.cid === newCid);
          if (matchingFile) newPinataId = matchingFile.id;
        }
      } catch (e) {
        console.error("Error retrieving backup V7 Pinata identifier:", e);
      }
    }

    // 2. Clean up the obsolete asset reference from Pinata's nodes if it exists
    if (oldWorkflow?.pinata_file_id) {
      try {
        console.log(`[DELETE] Unpinning old asset ${oldWorkflow.pinata_file_id}`);
        const deleteResponse = await fetch(`https://api.pinata.cloud/v3/files/public/${oldWorkflow.pinata_file_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${PINATA_JWT}` },
        });
        if (deleteResponse.ok) {
          console.log(`[DELETE] Successfully removed old asset ${oldWorkflow.pinata_file_id}`);
        } else {
          const errTxt = await deleteResponse.text();
          console.error(`[DELETE] Failed to unpin old asset. Status ${deleteResponse.status}: ${errTxt}`);
        }
      } catch (err) {
        console.error(`[DELETE] Network error while unpinning:`, err);
      }
    }

    // 3. Update the tracking entry in your Supabase database table
    const { error: dbError } = await supabase
      .from("workflows")
      .update({
        cid: newCid,
        pinata_file_id: newPinataId || oldWorkflow?.pinata_file_id,
        json: json,
        name: name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dbRowId);

    if (dbError) {
      throw new Error(`Database record mutation failed: ${dbError.message}`);
    }

    // Ensure response always contains the Pinata file identifier
    const responsePayload = {
      success: true,
      cid: newCid,
      pinata_file_id: newPinataId || oldWorkflow?.pinata_file_id,
    };
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});