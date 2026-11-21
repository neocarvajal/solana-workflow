import { json, loadCrank } from "../_shared/vault.ts";

/**
 * Public configuration for the vault panel.
 *
 * Only the crank's public address is exposed here. The private key stays in
 * VAULT_CRANK_SECRET_KEY inside the Supabase function environment.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method === "GET" || req.method === "POST") {
    try {
      const keeper = loadCrank().publicKey.toBase58();
      return json({
        keeper,
        executionEnabled: Deno.env.get("VAULT_EXECUTION_ENABLED") === "true",
      });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error ? error.message : "No se pudo cargar la configuración",
        },
        500,
      );
    }
  }
  return json({ error: "Method not allowed" }, 405);
});
