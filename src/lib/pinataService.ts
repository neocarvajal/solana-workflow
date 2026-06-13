import { supabase } from "@/integrations/supabase/client.ts";

export async function pinJSONToIPFS(jsonBody: any, name: string): Promise<string> {

  const { data, error } = await supabase.functions.invoke('pin-to-ipfs', {
    body: { json: jsonBody, name }
  });

  if (error) throw error;
  return data.cid;
}

/**
 * Fetches a JSON object from IPFS using the Edge Function.
 * This approach centralizes the request, providing failover across multiple gateways.
 */
export async function fetchJSONFromIPFS(cid: string): Promise<any> {
  try {
    // Invoke the 'fetch-ipfs' Edge Function
    const { data, error } = await supabase.functions.invoke('fetch-ipfs', {
      body: { cid }
    });

    if (error) {
      throw new Error(`Error calling Edge Function: ${error.message}`);
    }

    // Return the JSON content extracted from the response
    return data.json;
    
  } catch (err) {
    console.error("Failed to retrieve workflow from IPFS:", err);
    throw err;
  }
}