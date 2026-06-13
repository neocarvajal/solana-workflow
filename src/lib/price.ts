export const getPrice = async (asset: string): Promise<number> => {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  // Convertimos el string "SOL" al Mint correspondiente para la consulta
  const address = asset === "SOL" ? SOL_MINT : asset;

  // Intentamos leer la API Key desde las variables de entorno de Vite (.env)
  const JUP_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API || "";

  try {
    const response = await fetch(`https://api.jup.ag/price/v3?ids=${address}`, {
      method: "GET",
      headers: {
        "x-api-key": JUP_API_KEY,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Jupiter API returned status ${response.status}`);
    }

    const priceData = await response.json();
    
    // La API v3 devuelve: { data: { "MINT": { id: "...", type: "...", price: 140.5 } } }
    const assetData = priceData?.data?.[address];

    if (!assetData || typeof assetData.price !== "number") {
      throw new Error(`Price field missing or malformed for address: ${address}`);
    }

    return assetData.price;

  } catch (error: any) {
    console.error(`[PRICE FETCH ERROR] Failed to fetch price from Jupiter V3 for ${asset}:`, error.message);
    
    // MOCK DE RESPALDO (FALLBACK) para que el simulador 'Run Once' no explote si no hay internet o API Key
    if (asset === "SOL" || address === SOL_MINT) {
      return 140.00; 
    }
    return 1.00; // Valor por defecto si es una stablecoin o token desconocido
  }
};