module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/src/lib/solana.ts [api] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "SOLANA_CLUSTER",
    ()=>SOLANA_CLUSTER,
    "connection",
    ()=>connection,
    "explorerAddrUrl",
    ()=>explorerAddrUrl,
    "getPhantom",
    ()=>getPhantom,
    "listOnchainWorkflows",
    ()=>listOnchainWorkflows,
    "publishWorkflowMemo",
    ()=>publishWorkflowMemo,
    "shortAddr",
    ()=>shortAddr,
    "solscanUrl",
    ()=>solscanUrl
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__ = __turbopack_context__.i("[externals]/@solana/web3.js [external] (@solana/web3.js, cjs, [project]/node_modules/@solana/web3.js)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$bs58__$5b$external$5d$__$28$bs58$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$bs58$29$__ = __turbopack_context__.i("[externals]/bs58 [external] (bs58, esm_import, [project]/node_modules/bs58)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$bs58__$5b$external$5d$__$28$bs58$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$bs58$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$bs58__$5b$external$5d$__$28$bs58$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$bs58$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const CLUSTER = ("TURBOPACK compile-time value", "devnet") || "devnet";
const SOLANA_CLUSTER = CLUSTER;
const connection = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["Connection"]((0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["clusterApiUrl"])(CLUSTER), "confirmed");
const MEMO_PROGRAM_ID = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["PublicKey"]("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
function getPhantom() {
    const w = window;
    return w?.solana?.isPhantom ? w.solana : null;
}
function solscanUrl(sig) {
    const c = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : `?cluster=${CLUSTER}`;
    return `https://solscan.io/tx/${sig}${c}`;
}
function explorerAddrUrl(addr) {
    const c = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : `?cluster=${CLUSTER}`;
    return `https://solscan.io/account/${addr}${c}`;
}
async function publishWorkflowMemo(walletTools, payload) {
    const { publicKey, sendTransaction } = walletTools;
    if (!publicKey) throw new Error("Wallet not connected");
    const memo = JSON.stringify({
        v: 1,
        app: "solflows",
        ...payload
    });
    const ix = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["TransactionInstruction"]({
        keys: [
            {
                pubkey: publicKey,
                isSigner: true,
                isWritable: true
            }
        ],
        programId: MEMO_PROGRAM_ID,
        data: new TextEncoder().encode(memo)
    });
    const tx = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["Transaction"]().add(ix);
    tx.feePayer = publicKey;
    // Obtenemos el blockhash más reciente usando la conexión configurada
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    // Enviamos y firmamos la transacción delegando el proceso al Adapter de la Wallet activa
    const sig = await sendTransaction(tx, connection);
    // Confirmamos la transacción
    await connection.confirmTransaction(sig, "confirmed");
    return {
        signature: sig
    };
}
async function listOnchainWorkflows(owner, limit = 30) {
    const sigs = await connection.getSignaturesForAddress(owner, {
        limit
    });
    if (sigs.length === 0) return [];
    const txs = await connection.getParsedTransactions(sigs.map((s)=>s.signature), {
        maxSupportedTransactionVersion: 0
    });
    const out = [];
    txs.forEach((tx, i)=>{
        if (!tx) return;
        for (const ix of tx.transaction.message.instructions){
            const pid = ix.programId?.toBase58?.() || ix.programId;
            if (pid !== MEMO_PROGRAM_ID.toBase58()) continue;
            let raw;
            if (typeof ix.parsed === "string") raw = ix.parsed;
            else if (ix.parsed?.info) raw = ix.parsed.info;
            else if (ix.data) {
                try {
                    raw = new TextDecoder().decode(__TURBOPACK__imported__module__$5b$externals$5d2f$bs58__$5b$external$5d$__$28$bs58$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$bs58$29$__["default"].decode(ix.data));
                } catch  {}
            }
            if (!raw) continue;
            try {
                const p = JSON.parse(raw);
                if (p?.app === "solflows" && p?.cid) {
                    out.push({
                        signature: sigs[i].signature,
                        blockTime: sigs[i].blockTime ?? tx.blockTime ?? null,
                        payload: p
                    });
                }
            } catch  {}
        }
    });
    // Deduplicate by name, keep highest version / most recent
    const byName = new Map();
    for (const e of out){
        const prev = byName.get(e.payload.name);
        const newer = !prev || (e.payload.version ?? 0) > (prev.payload.version ?? 0) || (e.blockTime ?? 0) > (prev.blockTime ?? 0);
        if (newer) byName.set(e.payload.name, e);
    }
    return Array.from(byName.values()).sort((a, b)=>(b.blockTime ?? 0) - (a.blockTime ?? 0));
}
function shortAddr(a, n = 4) {
    return a.length > 2 * n + 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/pages/api/workflow/handlers/transferHandler.ts [api] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "handleTransferAction",
    ()=>handleTransferAction
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__ = __turbopack_context__.i("[externals]/@solana/web3.js [external] (@solana/web3.js, cjs, [project]/node_modules/@solana/web3.js)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__ = __turbopack_context__.i("[externals]/@solana/spl-token [external] (@solana/spl-token, esm_import, [project]/node_modules/@solana/spl-token)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$api$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/solana.ts [api] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$api$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$api$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
const DEVNET_MINTS = {
    USDC: {
        mint: new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["PublicKey"]("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
        decimals: 6
    },
    JUP: {
        mint: new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["PublicKey"]("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
        decimals: 6
    },
    BONK: {
        mint: new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["PublicKey"]("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
        decimals: 5
    }
};
async function handleTransferAction(owner, params) {
    console.log("TRANSFER HANDLER PARAMS", JSON.stringify(params, null, 2));
    const asset = params.asset?.toUpperCase();
    if (!asset || !params.to || !params.amount) {
        throw new Error("Faltan parámetros requeridos en el nodo de transferencia.");
    }
    if (asset === "SOL") {
        throw new Error("La simulación de SOL nativo requiere Wrapped SOL o ejecución vía Vault/PDA.");
    }
    const tokenConfig = DEVNET_MINTS[asset];
    if (!tokenConfig) throw new Error(`El token ${asset} no está soportado en Devnet.`);
    const ownerPk = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["PublicKey"](owner);
    const toPk = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["PublicKey"](params.to);
    const transaction = new __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$web3$2e$js__$5b$external$5d$__$2840$solana$2f$web3$2e$js$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$29$__["Transaction"]();
    const sourceATA = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__["getAssociatedTokenAddress"])(tokenConfig.mint, ownerPk);
    const destinationATA = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__["getAssociatedTokenAddress"])(tokenConfig.mint, toPk);
    const destinationAccountInfo = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$api$5d$__$28$ecmascript$29$__["connection"].getAccountInfo(destinationATA);
    if (!destinationAccountInfo) {
        transaction.add((0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__["createAssociatedTokenAccountInstruction"])(ownerPk, destinationATA, toPk, tokenConfig.mint));
    }
    const rawAmount = parseFloat(params.amount) * Math.pow(10, tokenConfig.decimals);
    transaction.add((0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$spl$2d$token__$5b$external$5d$__$2840$solana$2f$spl$2d$token$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$spl$2d$token$29$__["createTransferCheckedInstruction"])(sourceATA, tokenConfig.mint, destinationATA, ownerPk, rawAmount, tokenConfig.decimals));
    transaction.feePayer = ownerPk;
    const { blockhash } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$api$5d$__$28$ecmascript$29$__["connection"].getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    return transaction.serialize({
        requireAllSignatures: false
    }).toString("base64");
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/pages/api/workflow/handlers/swapHandler.ts [api] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleSwapAction",
    ()=>handleSwapAction
]);
async function handleSwapAction(owner, params) {
    // TODO: Aquí harás el fetch a https://quote-api.jup.ag/v6/quote
    // Luego a /swap para obtener las instrucciones serializadas,
    // y finalmente las devolverás estructuradas.
    throw new Error("El módulo de intercambio dinámico (Jupiter Swap) está en desarrollo.");
}
}),
"[project]/src/pages/api/workflow/simulate-tx.ts [api] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>handler
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$api$2f$workflow$2f$handlers$2f$transferHandler$2e$ts__$5b$api$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/api/workflow/handlers/transferHandler.ts [api] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$api$2f$workflow$2f$handlers$2f$swapHandler$2e$ts__$5b$api$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/api/workflow/handlers/swapHandler.ts [api] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$api$2f$workflow$2f$handlers$2f$transferHandler$2e$ts__$5b$api$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$api$2f$workflow$2f$handlers$2f$transferHandler$2e$ts__$5b$api$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed. Use POST."
        });
    }
    try {
        const { actionType, owner, params } = req.body;
        if (!actionType || !owner || !params) {
            return res.status(400).json({
                error: "Faltan parámetros obligatorios en la petición."
            });
        }
        let serializedTx;
        switch(actionType){
            case "send_transaction":
                serializedTx = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$api$2f$workflow$2f$handlers$2f$transferHandler$2e$ts__$5b$api$5d$__$28$ecmascript$29$__["handleTransferAction"])(owner, params);
                break;
            case "swap":
                serializedTx = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$api$2f$workflow$2f$handlers$2f$swapHandler$2e$ts__$5b$api$5d$__$28$ecmascript$29$__["handleSwapAction"])(owner, params);
                break;
            default:
                return res.status(400).json({
                    error: `La acción '${actionType}' no está soportada.`
                });
        }
        return res.status(200).json({
            serializedTx
        });
    } catch (error) {
        console.error("❌ Error en Router de Simulación:", error);
        return res.status(500).json({
            error: error.message || "Internal Server Error"
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1argv0s._.js.map