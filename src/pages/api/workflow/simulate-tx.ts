import type { NextApiRequest, NextApiResponse } from "next";
import { handleTransferAction } from "./handlers/transferHandler";
import { handleSwapAction } from "./handlers/swapHandler";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { actionType, owner, params } = req.body;

    if (!actionType || !owner || !params) {
      return res.status(400).json({ error: "Faltan parámetros obligatorios en la petición." });
    }

    let serializedTx: string;

    switch (actionType) {
      case "send_transaction":
        serializedTx = await handleTransferAction(owner, params);
        break;

      case "swap":
        serializedTx = await handleSwapAction(owner, params);
        break;

      default:
        return res.status(400).json({ error: `La acción '${actionType}' no está soportada.` });
    }

    return res.status(200).json({ serializedTx });

  } catch (error: any) {
    console.error("❌ Error en Router de Simulación:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}