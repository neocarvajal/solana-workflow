export const getPrice = async (asset: string): Promise<number> => {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const address = asset === "SOL" ? SOL_MINT : asset;

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

    const assetData = priceData?.data?.[address];

    if (!assetData || typeof assetData.price !== "number") {
      throw new Error(`Price field missing or malformed for address: ${address}`);
    }

    return assetData.price;

  } catch (error: any) {
    console.error(`[PRICE FETCH ERROR] Failed to fetch price from Jupiter V3 for ${asset}:`, error.message);

    if (asset === "SOL" || address === SOL_MINT) {
      return 140.00;
    }
    return 1.00;
  }
};