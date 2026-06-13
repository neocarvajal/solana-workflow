import type { NextApiRequest, NextApiResponse } from 'next';

const QUICKNODE_HTTP_URL = process.env.NEXT_PUBLIC_QUICKNODE_HTTP_URL;

// Helper to perform a swap of 1 SOL to USDC using Jupiter via QuickNode RPC
async function swapSolToUsdc(userPublicKey: string) {
  if (!QUICKNODE_HTTP_URL) {
    console.error('QUICKNODE_HTTP_URL not set');
    return { error: 'Missing QUICKNODE_HTTP_URL' };
  }

  // First obtain a quote
  const quotePayload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'quote',
    params: {
      // Input: 1 SOL = 1_000_000 lamports
      inAmount: '1000000',
      inputMint: 'So11111111111111111111111111111111111111112', // SOL mint
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
      slippageBps: 10,
      swapMode: 'ExactIn'
    }
  };

  const quoteRes = await fetch(QUICKNODE_HTTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quotePayload)
  });

  const quoteJson = await quoteRes.json();
  if (!quoteJson.result) {
    console.error('Quote failed', quoteJson);
    return { error: 'Quote failed', details: quoteJson };
  }

  const quoteResponse = quoteJson.result;

  // Now perform the swap using the obtained quote
  const swapPayload = {
    jsonrpc: '2.0',
    id: 2,
    method: 'swap',
    params: {
      userPublicKey,
      quoteResponse,
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: 0
    }
  };

  const swapRes = await fetch(QUICKNODE_HTTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapPayload)
  });

  const swapJson = await swapRes.json();
  return swapJson;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Expected payload: { eventType, account (optional) }
  const { eventType, account } = req.body;

  // Resolve the monitored account – require request value
  const monitoredAccount = account;
  if (!monitoredAccount) {
    return res.status(400).json({ error: 'Missing monitored account (account is required)' });
  }

  // Simple validation
  if (!eventType) {
    return res.status(400).json({ error: 'Missing required field: eventType' });
  }

  // For demonstration, trigger a swap when a SOL transfer is detected
  if (eventType === 'transfer') {
    try {
      // Use the monitored account as the signer/public key for the swap
      const swapResult = await swapSolToUsdc(monitoredAccount);
      console.log('Swap result:', swapResult);
      return res.status(200).json({ message: 'Swap executed', swapResult });
    } catch (e) {
      console.error('Swap error', e);
      return res.status(500).json({ error: 'Swap execution failed', details: e });
    }
  }

  // Default – acknowledge receipt
  return res.status(200).json({ message: 'Webhook received', received: req.body });
}
