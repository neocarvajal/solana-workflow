export const getPrice = async (asset: string): Promise<number> => {
  const TOKEN_MAP: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    MF: "moonThZEkkTVoNB7v6YVCQiT56JYDZ1oN185ba3WizL",
  };

  const address = TOKEN_MAP[asset.toUpperCase()] || asset;

  const response = await fetch(
    `https://api.jup.ag/price/v3?ids=${address}`,
    {
      headers: {
        "x-api-key":
          process.env.NEXT_PUBLIC_JUPITER_API || "",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Jupiter API error ${response.status}`
    );
  }

  const json = await response.json();

  const assetData =
    json?.data?.[address] || json?.[address];

  const price = assetData?.usdPrice;

  if (typeof price !== "number") {
    throw new Error(
      `Invalid price for ${asset} (${address})`
    );
  }

  return price;
};