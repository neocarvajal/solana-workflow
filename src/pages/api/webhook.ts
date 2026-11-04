import type { NextApiRequest, NextApiResponse } from "next";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

// Necesitamos el body crudo para validar la firma HMAC de Alchemy.
export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function isValidSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}

type AlchemyActivity = {
  fromAddress?: string;
  toAddress?: string;
  address?: string;
  value?: number | string;
  amount?: number | string;
  hash?: string;
  transactionHash?: string;
  category?: string;
  asset?: string;
};

function activitiesFrom(payload: unknown): AlchemyActivity[] {
  const body = payload as Record<string, any> | null;

  if (Array.isArray(body?.event?.activity)) return body.event.activity;
  if (Array.isArray(body?.activity)) return body.activity;
  if (body?.event?.transaction) return [body.event.transaction];

  return [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;

  // Fail-closed: si no hay clave configurada no aceptamos eventos.
  if (!signingKey) {
    console.error("ALCHEMY_WEBHOOK_SIGNING_KEY no está configurada");
    return res.status(503).json({ error: "Webhook no configurado" });
  }

  const signatureHeader = req.headers["x-alchemy-signature"];
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;

  let rawBody: Buffer;

  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    console.error("No se pudo leer el body del webhook:", e);
    return res.status(400).json({ error: "Body inválido" });
  }

  if (!isValidSignature(rawBody, signature, signingKey)) {
    console.error("Firma de Alchemy inválida");
    return res.status(401).json({ error: "Firma inválida" });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (_e) {
    return res.status(400).json({ error: "JSON inválido" });
  }

  const activities = activitiesFrom(payload);

  if (activities.length === 0) {
    return res.status(200).json({ message: "Evento sin actividad, ignorado" });
  }

  const rows = activities
    .map((activity) => {
      const wallet =
        activity.toAddress || activity.fromAddress || activity.address;

      if (!wallet) return null;

      const amount = activity.value ?? activity.amount ?? "0";

      return {
        wallet_address: wallet,
        action: activity.category || "onchain_activity",
        status: "pending",
        amount: String(amount),
        tx_hash: activity.hash || activity.transactionHash || null,
        created_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return res.status(200).json({ message: "Actividad sin wallet, ignorada" });
  }

  const { error } = await supabase.from("pending_actions").insert(rows);

  if (error) {
    console.error("Error al insertar en pending_actions:", error);
    return res.status(500).json({ error: "Error interno de base de datos" });
  }

  return res.status(200).json({
    message: "Evento guardado exitosamente",
    inserted: rows.length,
  });
}
