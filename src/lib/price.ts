export const getPrice = async (asset: string): Promise<number> => {
  const SOL_MINT =
    "So11111111111111111111111111111111111111112";

  const address = asset === "SOL" ? SOL_MINT : asset;

  const response = await fetch(
    `https://api.jup.ag/price/v3?ids=${address}`,
    {
      headers: {
        "x-api-key": process.env.NEXT_PUBLIC_JUPITER_API || "",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Jupiter API error ${response.status}`);
  }

  const json = await response.json();

  const assetData = json?.[address];

  const price = assetData?.usdPrice;

  if (typeof price !== "number") {
    throw new Error(`Invalid price for ${asset}`);
  }

  return price;
};