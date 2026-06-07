const PINATA_JWT = import.meta.env.PINATA_JWT

/**
 * Pins a JSON object to Pinata (IPFS).
 * Returns the CID of the pinned file.
 */
export async function pinJSONToIPFS(jsonBody: any, name: string): Promise<string> {
  const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

  const body = {
    pinataContent: jsonBody,
    pinataMetadata: {
      name: name,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to pin to IPFS: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.IpfsHash;
}

/**
 * Fetches JSON from an IPFS gateway using the CID.
 */
export async function fetchJSONFromIPFS(cid: string): Promise<any> {
  // Using a public gateway. For production, consider using a dedicated Pinata gateway.
  const url = `https://gateway.pinata.cloud/ipfs/${cid}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
