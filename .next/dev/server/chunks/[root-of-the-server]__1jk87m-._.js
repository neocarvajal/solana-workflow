module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/src/pages/api/webhook.ts [api] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>handler
]);
// Environment variables (add these to .env.local)
const QUICKNODE_HTTP_URL = ("TURBOPACK compile-time value", "https://ancient-white-hill.solana-devnet.quiknode.pro/0fd580fb88cbf6b8ae7aad32ea0e9da47d754714/"); // e.g. https://ancient-white-hill.solana-devnet.quiknode.pro/0fd580fb88cbf6b8ae7aad32ea0e9da47d754714/
// Helper to perform a swap of 1 SOL to USDC using Jupiter via QuickNode RPC
async function swapSolToUsdc(userPublicKey) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // First obtain a quote
    const quotePayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'quote',
        params: {
            // Input: 1 SOL = 1_000_000 lamports
            inAmount: '1000000',
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            slippageBps: 10,
            swapMode: 'ExactIn'
        }
    };
    const quoteRes = await fetch(QUICKNODE_HTTP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(quotePayload)
    });
    const quoteJson = await quoteRes.json();
    if (!quoteJson.result) {
        console.error('Quote failed', quoteJson);
        return {
            error: 'Quote failed',
            details: quoteJson
        };
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
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(swapPayload)
    });
    const swapJson = await swapRes.json();
    return swapJson;
}
async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }
    // Expected payload: { eventType, account (optional) }
    const { eventType, account } = req.body;
    // Resolve the monitored account – require request value
    const monitoredAccount = account;
    if (!monitoredAccount) {
        return res.status(400).json({
            error: 'Missing monitored account (account is required)'
        });
    }
    // Simple validation
    if (!eventType) {
        return res.status(400).json({
            error: 'Missing required field: eventType'
        });
    }
    // For demonstration, trigger a swap when a SOL transfer is detected
    if (eventType === 'transfer') {
        try {
            // Use the monitored account as the signer/public key for the swap
            const swapResult = await swapSolToUsdc(monitoredAccount);
            console.log('Swap result:', swapResult);
            return res.status(200).json({
                message: 'Swap executed',
                swapResult
            });
        } catch (e) {
            console.error('Swap error', e);
            return res.status(500).json({
                error: 'Swap execution failed',
                details: e
            });
        }
    }
    // Default – acknowledge receipt
    return res.status(200).json({
        message: 'Webhook received',
        received: req.body
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1jk87m-._.js.map