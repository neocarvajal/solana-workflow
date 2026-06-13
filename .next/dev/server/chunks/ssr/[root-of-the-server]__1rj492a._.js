module.exports = [
"[project]/src/lib/solana.ts [ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/src/components/WalletButton.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__ = __turbopack_context__.i("[externals]/@solana/wallet-adapter-react [external] (@solana/wallet-adapter-react, esm_import, [project]/node_modules/@solana/wallet-adapter-react)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$29$__ = __turbopack_context__.i("[externals]/@solana/wallet-adapter-react-ui [external] (@solana/wallet-adapter-react-ui, esm_import, [project]/node_modules/@solana/wallet-adapter-react-ui)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wallet.js [ssr] (ecmascript) <export default as Wallet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/solana.ts [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
const WalletButton = ()=>{
    const { publicKey, disconnect, connecting } = (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__["useWallet"])();
    const { setVisible } = (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$29$__["useWalletModal"])();
    const address = publicKey ? publicKey.toBase58() : null;
    const handleClick = ()=>{
        if (address) {
            disconnect();
        } else {
            setVisible(true);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
        onClick: handleClick,
        disabled: connecting,
        className: `px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 text-sm ${address ? "bg-muted text-primary border border-primary" : "bg-gradient-purple-cyan text-white"}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                className: "h-4 w-4"
            }, void 0, false, {
                fileName: "[project]/src/components/WalletButton.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            connecting ? "Conectando..." : address ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["shortAddr"])(address) : "Conectar Wallet"
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/WalletButton.tsx",
        lineNumber: 21,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
const __TURBOPACK__default__export__ = WalletButton;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/react-dom [external] (react-dom, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("react-dom", () => require("react-dom"));

module.exports = mod;
}),
"[project]/src/components/ui/sheet.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "Sheet",
    ()=>Sheet,
    "SheetClose",
    ()=>SheetClose,
    "SheetContent",
    ()=>SheetContent,
    "SheetDescription",
    ()=>SheetDescription,
    "SheetFooter",
    ()=>SheetFooter,
    "SheetHeader",
    ()=>SheetHeader,
    "SheetOverlay",
    ()=>SheetOverlay,
    "SheetPortal",
    ()=>SheetPortal,
    "SheetTitle",
    ()=>SheetTitle,
    "SheetTrigger",
    ()=>SheetTrigger
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__ = __turbopack_context__.i("[externals]/@radix-ui/react-dialog [external] (@radix-ui/react-dialog, esm_import, [project]/node_modules/@radix-ui/react-dialog)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$class$2d$variance$2d$authority__$5b$external$5d$__$28$class$2d$variance$2d$authority$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$29$__ = __turbopack_context__.i("[externals]/class-variance-authority [external] (class-variance-authority, esm_import, [project]/node_modules/class-variance-authority)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react [external] (react, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f$class$2d$variance$2d$authority__$5b$external$5d$__$28$class$2d$variance$2d$authority$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f$class$2d$variance$2d$authority__$5b$external$5d$__$28$class$2d$variance$2d$authority$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
const Sheet = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Root"];
const SheetTrigger = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Trigger"];
const SheetClose = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Close"];
const SheetPortal = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Portal"];
const SheetOverlay = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["forwardRef"](({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Overlay"], {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["cn"])("fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
        ...props,
        ref: ref
    }, void 0, false, {
        fileName: "[project]/src/components/ui/sheet.tsx",
        lineNumber: 20,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
SheetOverlay.displayName = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Overlay"].displayName;
const sheetVariants = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$class$2d$variance$2d$authority__$5b$external$5d$__$28$class$2d$variance$2d$authority$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$29$__["cva"])("fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500", {
    variants: {
        side: {
            top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
            bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
            right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
        }
    },
    defaultVariants: {
        side: "right"
    }
});
const SheetContent = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["forwardRef"](({ side = "right", className, children, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(SheetPortal, {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(SheetOverlay, {}, void 0, false, {
                fileName: "[project]/src/components/ui/sheet.tsx",
                lineNumber: 59,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Content"], {
                ref: ref,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["cn"])(sheetVariants({
                    side
                }), className),
                ...props,
                children: [
                    children,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Close"], {
                        className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/sheet.tsx",
                                lineNumber: 67,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/sheet.tsx",
                                lineNumber: 68,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/sheet.tsx",
                        lineNumber: 66,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/sheet.tsx",
                lineNumber: 60,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/sheet.tsx",
        lineNumber: 58,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
SheetContent.displayName = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Content"].displayName;
const SheetHeader = ({ className, ...props })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["cn"])("flex flex-col space-y-2 text-center sm:text-left", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/sheet.tsx",
        lineNumber: 79,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
SheetHeader.displayName = "SheetHeader";
const SheetFooter = ({ className, ...props })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["cn"])("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/sheet.tsx",
        lineNumber: 93,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
SheetFooter.displayName = "SheetFooter";
const SheetTitle = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["forwardRef"](({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Title"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["cn"])("text-lg font-semibold text-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/sheet.tsx",
        lineNumber: 107,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
SheetTitle.displayName = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Title"].displayName;
const SheetDescription = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["forwardRef"](({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Description"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["cn"])("text-sm text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/sheet.tsx",
        lineNumber: 119,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
SheetDescription.displayName = __TURBOPACK__imported__module__$5b$externals$5d2f40$radix$2d$ui$2f$react$2d$dialog__$5b$external$5d$__$2840$radix$2d$ui$2f$react$2d$dialog$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$29$__["Description"].displayName;
;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/integrations/supabase/client.ts [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
// This file is automatically generated. Do not edit it directly.
var __TURBOPACK__imported__module__$5b$externals$5d2f40$supabase$2f$supabase$2d$js__$5b$external$5d$__$2840$supabase$2f$supabase$2d$js$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$29$__ = __turbopack_context__.i("[externals]/@supabase/supabase-js [external] (@supabase/supabase-js, esm_import, [project]/node_modules/@supabase/supabase-js)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f40$supabase$2f$supabase$2d$js__$5b$external$5d$__$2840$supabase$2f$supabase$2d$js$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f40$supabase$2f$supabase$2d$js__$5b$external$5d$__$2840$supabase$2f$supabase$2d$js$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
const SUPABASE_URL = ("TURBOPACK compile-time value", "https://hessksbxjcfkmujiqhnr.supabase.co");
const SUPABASE_PUBLISHABLE_KEY = ("TURBOPACK compile-time value", "sb_publishable_FmQ2Cfd_Y--n4Yc05IeUfw_UFMXnB1c");
const isBrowser = ("TURBOPACK compile-time value", "undefined") !== "undefined";
const supabase = (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$supabase$2f$supabase$2d$js__$5b$external$5d$__$2840$supabase$2f$supabase$2d$js$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$29$__["createClient"])(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        storage: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined,
        persistSession: true,
        autoRefreshToken: true
    }
});
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/lib/workflow.ts [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "ALL_MODULES",
    ()=>ALL_MODULES,
    "STEP_MODULES",
    ()=>STEP_MODULES,
    "TRIGGER_MODULES",
    ()=>TRIGGER_MODULES,
    "getDeviceId",
    ()=>getDeviceId,
    "moduleFor",
    ()=>moduleFor,
    "nodesToWorkflow",
    ()=>nodesToWorkflow,
    "workflowToNodes",
    ()=>workflowToNodes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/activity.js [ssr] (ecmascript) <export default as Activity>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bell.js [ssr] (ecmascript) <export default as Bell>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$braces$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Braces$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/braces.js [ssr] (ecmascript) <export default as Braces>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock.js [ssr] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.js [ssr] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$line$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__LineChart$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chart-line.js [ssr] (ecmascript) <export default as LineChart>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [ssr] (ecmascript) <export default as Send>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [ssr] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$webhook$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Webhook$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/webhook.js [ssr] (ecmascript) <export default as Webhook>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2d$right$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeftRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left-right.js [ssr] (ecmascript) <export default as ArrowLeftRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const TRIGGER_MODULES = [
    {
        type: "price_monitor",
        kind: "trigger",
        name: "Price Monitor",
        description: "Triggers on token price",
        color: "#14F195",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$line$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__LineChart$3e$__["LineChart"],
        defaultParams: {
            asset: "SOL",
            condition: "below",
            value: 80,
            interval: "1m"
        }
    },
    {
        type: "dexscreener_pair",
        kind: "trigger",
        name: "DexScreener Pair",
        description: "Watch a pair",
        color: "#FF6B6B",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__["Activity"],
        defaultParams: {
            pairAddress: "",
            metric: "price",
            condition: "above",
            value: 0
        }
    },
    {
        type: "schedule",
        kind: "trigger",
        name: "Schedule",
        description: "Run periodically",
        color: "#FFB020",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"],
        defaultParams: {
            every: "15m"
        }
    },
    {
        type: "webhook",
        kind: "trigger",
        name: "Webhook In",
        description: "HTTP entry point",
        color: "#D85A6A",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$webhook$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Webhook$3e$__["Webhook"],
        defaultParams: {
            path: "/incoming"
        }
    }
];
const STEP_MODULES = [
    {
        type: "send_transaction",
        kind: "step",
        name: "Wallet Transfer",
        description: "Send SOL / SPL",
        color: "#9945FF",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"],
        defaultParams: {
            to: "",
            amount: 1,
            asset: "USDC"
        }
    },
    {
        type: "send_alert",
        kind: "step",
        name: "Alert",
        description: "Notify user",
        color: "#F59E0B",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__["Bell"],
        defaultParams: {
            channel: "app",
            message: "Trigger fired!"
        }
    },
    {
        type: "swap",
        kind: "step",
        name: "Jupiter Swap",
        description: "Token swap",
        color: "#22D3EE",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2d$right$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeftRight$3e$__["ArrowLeftRight"],
        defaultParams: {
            from: "SOL",
            to: "USDC",
            amount: 1
        }
    },
    {
        type: "http_request",
        kind: "step",
        name: "HTTP Request",
        description: "Call an API",
        color: "#2196F3",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"],
        defaultParams: {
            method: "POST",
            url: "",
            body: {}
        }
    },
    {
        type: "ai_decision",
        kind: "step",
        name: "AI Agent",
        description: "LLM reasoning",
        color: "#10A37F",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"],
        defaultParams: {
            prompt: "Analyze the data and decide next action."
        }
    },
    {
        type: "dexscreener_lookup",
        kind: "step",
        name: "DexScreener Lookup",
        description: "Fetch pair data",
        color: "#FF6B6B",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$braces$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Braces$3e$__["Braces"],
        defaultParams: {
            pairAddress: ""
        }
    }
];
const ALL_MODULES = [
    ...TRIGGER_MODULES,
    ...STEP_MODULES
];
function moduleFor(type) {
    return ALL_MODULES.find((m)=>m.type === type);
}
const NODE_SPACING_X = 220;
const START_X = 200;
const START_Y = 300;
function workflowToNodes(wf) {
    console.log('[workflowToNodes] Received workflow:', JSON.stringify(wf, null, 2));
    const nodes = [];
    let idx = 0;
    const settings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["getSettings"])();
    const globalWallet = settings?.recipientWallet || "";
    const normalize = (module, params)=>{
        const defaults = module.defaultParams || {};
        const allowedKeys = Object.keys(defaults);
        const cleanParams = {
            ...defaults
        };
        if (params) {
            allowedKeys.forEach((key)=>{
                if (params[key] !== undefined) {
                    cleanParams[key] = params[key];
                }
            });
        }
        if (params?.fromAsset && !cleanParams.asset) {
            cleanParams.asset = params.fromAsset;
        }
        return cleanParams;
    };
    const t = moduleFor(wf.trigger.type);
    if (t) {
        const pos = wf.trigger.params?._pos;
        console.log('[workflowToNodes] Added Trigger node', {
            id: `n-${Date.now()}-trig`,
            type: t.type,
            params: normalize(t, wf.trigger.params)
        });
        nodes.push({
            id: `n-${Date.now()}-trig`,
            module: t,
            params: normalize(t, wf.trigger.params),
            x: pos?.x ?? START_X + idx * NODE_SPACING_X,
            y: pos?.y ?? START_Y
        });
        idx++;
    }
    wf.steps.forEach((s, i)=>{
        const m = moduleFor(s.type);
        if (m) {
            const pos = s.params?._pos;
            nodes.push({
                id: `n-${Date.now()}-${i}`,
                module: m,
                params: normalize(m, s.params),
                x: pos?.x ?? START_X + idx * NODE_SPACING_X,
                y: pos?.y ?? START_Y
            });
            console.log('[workflowToNodes] Added Step node', {
                id: `n-${Date.now()}-${i}`,
                type: m.type,
                params: normalize(m, s.params)
            });
            idx++;
        }
    });
    return nodes;
}
function nodesToWorkflow(name, nodes) {
    if (nodes.length === 0) return null;
    const [first, ...rest] = nodes;
    if (first.module.kind !== "trigger") return null;
    return {
        name,
        trigger: {
            type: first.module.type,
            params: {
                ...first.params,
                _pos: {
                    x: first.x,
                    y: first.y
                }
            }
        },
        steps: rest.map((n)=>({
                type: n.module.type,
                params: {
                    ...n.params,
                    _pos: {
                        x: n.x,
                        y: n.y
                    }
                }
            }))
    };
}
const KEY = "solflows_device_id";
function getDeviceId() {
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(KEY, id);
    }
    return id;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/lib/workflowStore.ts [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "deleteWorkflow",
    ()=>deleteWorkflow,
    "getAnimatingLineIndex",
    ()=>getAnimatingLineIndex,
    "getCanvasScale",
    ()=>getCanvasScale,
    "getEditingId",
    ()=>getEditingId,
    "getFlowNodes",
    ()=>getFlowNodes,
    "getOnchainMeta",
    ()=>getOnchainMeta,
    "getRunningNodeId",
    ()=>getRunningNodeId,
    "getSavedWorkflows",
    ()=>getSavedWorkflows,
    "getScenarioName",
    ()=>getScenarioName,
    "getSettings",
    ()=>getSettings,
    "getWorkflow",
    ()=>getWorkflow,
    "listIpfsFiles",
    ()=>listIpfsFiles,
    "normalizeParams",
    ()=>normalizeParams,
    "saveLocalOnly",
    ()=>saveLocalOnly,
    "saveSettings",
    ()=>saveSettings,
    "saveWorkflow",
    ()=>saveWorkflow,
    "setAnimatingLineIndex",
    ()=>setAnimatingLineIndex,
    "setCanvasScale",
    ()=>setCanvasScale,
    "setEditingId",
    ()=>setEditingId,
    "setFlowNodes",
    ()=>setFlowNodes,
    "setOnchainMeta",
    ()=>setOnchainMeta,
    "setRunningNodeId",
    ()=>setRunningNodeId,
    "setScenarioName",
    ()=>setScenarioName,
    "setWorkflow",
    ()=>setWorkflow,
    "subscribeAnimatingLine",
    ()=>subscribeAnimatingLine,
    "subscribeNodes",
    ()=>subscribeNodes,
    "subscribeRunningNode",
    ()=>subscribeRunningNode,
    "subscribeScale",
    ()=>subscribeScale,
    "subscribeWorkflow",
    ()=>subscribeWorkflow,
    "updateWorkflow",
    ()=>updateWorkflow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflow.ts [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/integrations/supabase/client.ts [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
let currentEditingId = null;
let current = null;
let onchainMeta = {};
const listeners = new Set();
function getWorkflow() {
    return current;
}
function getOnchainMeta() {
    return onchainMeta;
}
function getEditingId() {
    return currentEditingId;
}
function setEditingId(id) {
    currentEditingId = id;
}
function setWorkflow(wf) {
    current = wf;
    listeners.forEach((l)=>l(current));
}
function setOnchainMeta(meta) {
    onchainMeta = meta;
}
function subscribeWorkflow(l) {
    listeners.add(l);
    return ()=>{
        listeners.delete(l);
    };
}
let flowNodes = [];
let scenarioName = "My Scenario";
const nodesListeners = new Set();
function getFlowNodes() {
    return flowNodes;
}
function getScenarioName() {
    return scenarioName;
}
function setScenarioName(name) {
    scenarioName = name;
    syncWorkflow();
}
function setFlowNodes(nodes) {
    flowNodes = nodes;
    nodesListeners.forEach((l)=>l(flowNodes));
    syncWorkflow();
}
function subscribeNodes(l) {
    nodesListeners.add(l);
    return ()=>nodesListeners.delete(l);
}
function syncWorkflow() {
    const wf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["nodesToWorkflow"])(scenarioName, flowNodes);
    setWorkflow(wf);
}
/* ── Settings (localStorage) ──────────────────────────────── */ const SETTINGS_KEY = "solflows_settings";
function getSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return JSON.parse(raw);
    } catch  {}
    return {
        recipientWallet: "",
        alertChannel: "app"
    };
}
function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
let canvasScale = 1;
const scaleListeners = new Set();
function getCanvasScale() {
    return canvasScale;
}
function setCanvasScale(s) {
    canvasScale = Math.min(2, Math.max(0.3, s));
    scaleListeners.forEach((l)=>l(canvasScale));
}
function subscribeScale(l) {
    scaleListeners.add(l);
    return ()=>scaleListeners.delete(l);
}
let runningNodeId = null;
const runningNodeListeners = new Set();
function getRunningNodeId() {
    return runningNodeId;
}
function setRunningNodeId(id) {
    runningNodeId = id;
    runningNodeListeners.forEach((l)=>l(runningNodeId));
}
function subscribeRunningNode(l) {
    runningNodeListeners.add(l);
    return ()=>runningNodeListeners.delete(l);
}
let animatingLineIndex = -1;
const animatingLineListeners = new Set();
function getAnimatingLineIndex() {
    return animatingLineIndex;
}
function setAnimatingLineIndex(index) {
    animatingLineIndex = index;
    animatingLineListeners.forEach((l)=>l(animatingLineIndex));
}
function subscribeAnimatingLine(l) {
    animatingLineListeners.add(l);
    return ()=>animatingLineListeners.delete(l);
}
const normalizeParams = (module, params = {})=>{
    return {
        ...module.defaultParams || {},
        ...params || {}
    };
};
/* ── Saved workflows handling (Secure Integration) ────────── */ const SAVED_WORKFLOWS_KEY = "solflows_saved_workflows";
function getSavedWorkflows(walletAddress) {
    try {
        const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
        const allWorkflows = raw ? JSON.parse(raw) : [];
        // Filter by wallet
        const walletWorkflows = allWorkflows.filter((w)=>w.ownerWallet === walletAddress);
        // Deduplicate: if there are both a CID and a local-only entry for the same workflow (by id), keep the one with cid.
        const deduped = walletWorkflows.reduce((acc, cur)=>{
            const existing = acc.find((item)=>item.id === cur.id || item.pinataId === cur.pinataId);
            if (!existing) {
                return acc.concat([
                    cur
                ]);
            }
            // Prefer entry with cid
            if (cur.cid && !existing.cid) {
                // replace existing with cur
                return acc.map((item)=>item.id === existing.id && item.pinataId === existing.pinataId ? cur : item);
            }
            // otherwise keep existing
            return acc;
        }, []);
        return deduped;
    } catch  {
        return [];
    }
}
async function saveWorkflow(name, wf, walletAddress, signature, existingPinataId) {
    try {
        // Always pin the workflow via the 'pin-to-ipfs' function.
        const endpoint = 'pin-to-ipfs';
        const body = {
            json: wf,
            name,
            owner_wallet: walletAddress,
            signature
        };
        // Attempt to pin to IPFS. If it fails, fallback to local-only storage.
        let result;
        try {
            const { data, error: invokeError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["supabase"].functions.invoke(endpoint, {
                body
            });
            if (invokeError) {
                console.error('Supabase Function Error (pin-to-ipfs):', invokeError);
                throw new Error(`Cloud save failed: ${invokeError.message}`);
            }
            console.log('Cloud save response (pin-to-ipfs):', data);
            result = data; // { cid, id }
        } catch (pinErr) {
            console.error('Pinning to IPFS failed, falling back to local storage:', pinErr);
            // Save locally only
            const fallbackResult = {
                cid: undefined,
                id: undefined
            };
            const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
            const saved = raw ? JSON.parse(raw) : [];
            saved.push({
                id: `wf-${Date.now()}`,
                pinataId: undefined,
                name,
                created: Date.now(),
                workflow: wf,
                ownerWallet: walletAddress,
                cid: undefined
            });
            localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
            return fallbackResult;
        }
        // If we had an old Pinata ID, clean up the previous IPFS asset.
        // Update local storage: replace existing entry if we have an old Pinata ID, otherwise add new.
        const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
        const saved = raw ? JSON.parse(raw) : [];
        if (existingPinataId) {
            const index = saved.findIndex((s)=>s.pinataId === existingPinataId || s.id === existingPinataId);
            if (index !== -1) {
                const oldPinataId = saved[index].pinataId;
                const oldCid = saved[index].cid;
                saved[index] = {
                    ...saved[index],
                    name,
                    workflow: wf,
                    cid: result.cid,
                    pinataId: result.id || saved[index].pinataId
                };
                if (oldPinataId && oldPinataId !== result.id) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["supabase"].functions.invoke('delete-ipfs-file', {
                        body: {
                            pinata_file_id: oldPinataId,
                            cid: oldCid
                        }
                    }).catch((err)=>console.error('[Cleanup] Failed to delete old IPFS file:', err));
                }
            } else {
                // Fallback: treat as new workflow
                saved.push({
                    id: `wf-${Date.now()}`,
                    pinataId: result.id,
                    name,
                    created: Date.now(),
                    workflow: wf,
                    ownerWallet: walletAddress,
                    cid: result.cid
                });
            }
        } else {
            // New workflow (no previous Pinata ID)
            saved.push({
                id: `wf-${Date.now()}`,
                pinataId: result.id,
                name,
                created: Date.now(),
                workflow: wf,
                ownerWallet: walletAddress,
                cid: result.cid
            });
        }
        localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
        return result;
    } catch (e) {
        console.error("Failed to save workflow securely", e);
        throw e;
    }
}
async function listIpfsFiles() {
    const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;
    if (!PINATA_JWT) throw new Error('Missing PINATA_JWT env');
    const response = await fetch('https://api.pinata.cloud/data/pinList', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
            'Content-Type': 'application/json'
        }
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Pinata list failed ${response.status}: ${err}`);
    }
    const data = await response.json();
    return data?.rows || [];
}
function saveLocalOnly(name, wf, walletAddress) {
    try {
        const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
        const saved = raw ? JSON.parse(raw) : [];
        const id = `wf-${Date.now()}`;
        saved.push({
            id,
            name,
            created: Date.now(),
            workflow: wf,
            ownerWallet: walletAddress,
            cid: undefined
        });
        localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
    } catch (e) {
        console.error("Failed to save workflow locally", e);
        throw e;
    }
}
async function updateWorkflow(id, name, updatedData, walletAddress// -> walletAddress
) {
    const SAVED_WORKFLOWS_KEY = "solflows_saved_workflows";
    // Extraemos el JSON limpio del workflow sin capas intermedias
    const cleanWorkflowJson = updatedData.workflow ? updatedData.workflow : updatedData;
    // 1. Recuperamos el registro actual del LocalStorage para capturar los IDs viejos antes de sobreescribirlos
    const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    const existingIndex = saved.findIndex((w)=>w.id === id || w.pinataId === id);
    // Capture existing Pinata file ID and CID before overwriting
    const oldPinataId = saved[existingIndex]?.pinataId;
    const oldCid = saved[existingIndex]?.cid;
    console.log(`[updateWorkflow] Updating ID: ${id}, Old PinataId: ${oldPinataId}, Old CID: ${oldCid}`);
    // 2. PIN: Subimos el nuevo archivo usando la función que maneja actualización si existe Pinata ID
    // Si existe oldPinataId, la Edge Function 'update-ipfs-file' borrará la versión anterior
    const result = await saveWorkflow(name, cleanWorkflowJson, walletAddress, "skip", oldPinataId);
    if (!result || !result.cid) {
        throw new Error("Failed to pin the new workflow version to IPFS");
    }
    // 3. LOCALSTORAGE: Actualizamos el registro local reemplazando los hashes con los datos nuevos de la nube
    const updatedRecord = {
        id: id,
        name: name,
        created: saved[existingIndex]?.created || Date.now(),
        ownerWallet: walletAddress,
        workflow: cleanWorkflowJson,
        cid: result.cid,
        pinataId: result.id || result.pinataId
    };
    // (No longer needed) oldPinataId was captured earlier for cleanup.
    if (existingIndex > -1) {
        saved[existingIndex] = updatedRecord;
    } else {
        saved.push(updatedRecord);
    }
    // Reload UI nodes to reflect the updated workflow
    try {
        const freshNodes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["workflowToNodes"])(cleanWorkflowJson);
        setFlowNodes(freshNodes);
    } catch (e) {
        console.error('[updateWorkflow] Failed to reload nodes after IPFS update:', e);
    }
    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(saved));
    // Clean up any stale local‑only entries for the same workflow (same name & wallet) that lack a CID
    const cleaned = saved.filter((item)=>{
        // Keep the updated record (by id) and any entries that have a CID
        if (item.id === id) return true;
        if (item.cid) return true;
        // Remove entries with same name & wallet but no CID (old fallback)
        if (item.name === name && item.ownerWallet === walletAddress && !item.cid) return false;
        return true;
    });
    localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(cleaned));
    // Return the updated record
    return updatedRecord;
}
async function deleteWorkflow(id, pinataFileId, cid) {
    try {
        // 1. SI EXISTE EL ID DE PINATA O EL CID, LE AVISAMOS A LA EDGE FUNCTION
        if (pinataFileId || cid) {
            console.log(`[FRONTEND] Solicitando borrado en IPFS para file_id: ${pinataFileId} y cid: ${cid}`);
            const response = await fetch(`${("TURBOPACK compile-time value", "https://hessksbxjcfkmujiqhnr.supabase.co")}/functions/v1/delete-ipfs-file`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhlc3Nrc2J4amNma211amlxaG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODk0NjgsImV4cCI6MjA5Njg2NTQ2OH0.u5_bAUwjYZ_MULmPev0s2DkIRnHsCqF6poBHsUVaccU")}`
                },
                body: JSON.stringify({
                    pinata_file_id: pinataFileId,
                    cid: cid
                })
            });
            const result = response.status !== 204 ? await response.json().catch(()=>({})) : {};
            if (!response.ok) {
                console.error("[FRONTEND] La Edge Function rechazó el borrado en IPFS:", result.error || response.statusText);
            } else {
                console.log("[FRONTEND] ¡Archivo eliminado con éxito de IPFS/Pinata!");
            }
        } else {
            console.warn("[FRONTEND] No se detectaron credenciales de IPFS, se borrará solo localmente.");
        }
        const raw = localStorage.getItem(SAVED_WORKFLOWS_KEY);
        const saved = raw ? JSON.parse(raw) : [];
        const filtered = saved.filter((w)=>w.id !== id);
        localStorage.setItem(SAVED_WORKFLOWS_KEY, JSON.stringify(filtered));
        console.log("[FRONTEND] Workflow eliminado del LocalStorage.");
    } catch (e) {
        console.error("Failed to execute complete deletion workflow", e);
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/components/OnchainWorkflowsSheet.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react [external] (react, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/sheet.tsx [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/database.js [ssr] (ecmascript) <export default as Database>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/external-link.js [ssr] (ecmascript) <export default as ExternalLink>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [ssr] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [ssr] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [ssr] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/solana.ts [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__ = __turbopack_context__.i("[externals]/@solana/wallet-adapter-react [external] (@solana/wallet-adapter-react, esm_import, [project]/node_modules/@solana/wallet-adapter-react)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/integrations/supabase/client.ts [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__ = __turbopack_context__.i("[externals]/sonner [external] (sonner, esm_import, [project]/node_modules/sonner)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
;
;
const OnchainWorkflowsSheet = ()=>{
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(false);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(false);
    const [entries, setEntries] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])([]);
    const [loadingCid, setLoadingCid] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(null);
    const { publicKey } = (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__["useWallet"])();
    const load = async ()=>{
        if (!publicKey) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__["toast"].error("Connect your wallet first");
            return;
        }
        // const p = getPhantom();
        // if (!p?.publicKey) {
        //   toast.error("Connect your wallet first");
        //   return;
        // }
        setLoading(true);
        try {
            const list = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["listOnchainWorkflows"])(publicKey);
            setEntries(list);
        } catch (e) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__["toast"].error(e?.message || "Failed to fetch from chain");
        } finally{
            setLoading(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useEffect"])(()=>{
        if (open) load(); /* eslint-disable-next-line */ 
    }, [
        open
    ]);
    const loadOne = async (e)=>{
        setLoadingCid(e.payload.cid);
        try {
            const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["supabase"].functions.invoke("fetch-ipfs", {
                body: {
                    cid: e.payload.cid
                }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            const wf = data.json;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["setWorkflow"])(wf);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["setOnchainMeta"])({
                cid: e.payload.cid,
                signature: e.signature,
                version: e.payload.version
            });
            __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__["toast"].success(`Loaded "${wf.name}" from IPFS`);
            setOpen(false);
        } catch (err) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__["toast"].error(err?.message || "Could not fetch from IPFS");
        } finally{
            setLoadingCid(null);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["Sheet"], {
        open: open,
        onOpenChange: setOpen,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["SheetTrigger"], {
                asChild: true,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                    className: "px-3 py-2 rounded-full text-sm border border-border hover:bg-muted flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                            lineNumber: 65,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        "On-chain"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                    lineNumber: 64,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                lineNumber: 63,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["SheetContent"], {
                className: "w-[420px] sm:max-w-[420px] overflow-y-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["SheetHeader"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["SheetTitle"], {
                            className: "flex items-center justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("span", {
                                    children: "My on-chain workflows"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                    lineNumber: 72,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                                    onClick: load,
                                    className: "p-1 hover:bg-muted rounded",
                                    title: "Refresh",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                        className: `h-4 w-4 ${loading ? "animate-spin" : ""}`
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                        lineNumber: 74,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                    lineNumber: 73,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                            lineNumber: 71,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                        lineNumber: 70,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                        className: "mt-4 space-y-2",
                        children: [
                            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 text-sm text-muted-foreground",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                        className: "h-4 w-4 animate-spin"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                        lineNumber: 82,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    " Reading wallet history…"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                lineNumber: 81,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            !loading && entries.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                className: "text-sm text-muted-foreground p-4 border border-dashed rounded",
                                children: [
                                    "No published workflows for this wallet yet. Build a flow and click ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("b", {
                                        children: "Publish on-chain"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                        lineNumber: 87,
                                        columnNumber: 82
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                lineNumber: 86,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            entries.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                    className: "border border-border rounded-lg p-3 bg-card",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                            className: "flex items-start justify-between gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                                    className: "min-w-0",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                                            className: "font-medium truncate",
                                                            children: e.payload.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                            lineNumber: 94,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                                            className: "text-xs text-muted-foreground",
                                                            children: [
                                                                "cid ",
                                                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["shortAddr"])(e.payload.cid, 6),
                                                                " ",
                                                                e.payload.version ? `· v${e.payload.version}` : ""
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                            lineNumber: 95,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                                            className: "text-xs text-muted-foreground",
                                                            children: e.blockTime ? new Date(e.blockTime * 1000).toLocaleString() : ""
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                            lineNumber: 98,
                                                            columnNumber: 19
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                    lineNumber: 93,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("a", {
                                                    href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["solscanUrl"])(e.signature),
                                                    target: "_blank",
                                                    rel: "noreferrer",
                                                    className: "text-muted-foreground hover:text-foreground shrink-0",
                                                    title: "View on Solscan",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                                                        className: "h-4 w-4"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                        lineNumber: 109,
                                                        columnNumber: 19
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                    lineNumber: 102,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                            lineNumber: 92,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                                            onClick: ()=>loadOne(e),
                                            disabled: loadingCid === e.payload.cid,
                                            className: "mt-2 w-full text-xs flex items-center justify-center gap-1 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
                                            children: [
                                                loadingCid === e.payload.cid ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                    className: "h-3 w-3 animate-spin"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                    lineNumber: 118,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                                    className: "h-3 w-3"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                                    lineNumber: 120,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                "Load into canvas"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                            lineNumber: 112,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, e.signature, true, {
                                    fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                                    lineNumber: 91,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                        lineNumber: 79,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/OnchainWorkflowsSheet.tsx",
        lineNumber: 62,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
const __TURBOPACK__default__export__ = OnchainWorkflowsSheet;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/components/SettingsDialog.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react [external] (react, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2d$dom__$5b$external$5d$__$28$react$2d$dom$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react-dom [external] (react-dom, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/settings.js [ssr] (ecmascript) <export default as Settings>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [ssr] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/save.js [ssr] (ecmascript) <export default as Save>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wallet.js [ssr] (ecmascript) <export default as Wallet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bell.js [ssr] (ecmascript) <export default as Bell>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [ssr] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__ = __turbopack_context__.i("[externals]/sonner [external] (sonner, esm_import, [project]/node_modules/sonner)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
const SettingsDialog = ()=>{
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(false);
    const [recipient, setRecipient] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])("");
    const [alertChannel, setAlertChannel] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])("app");
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useEffect"])(()=>{
        setMounted(true);
        if (open) {
            const s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["getSettings"])();
            setRecipient(s.recipientWallet);
            setAlertChannel(s.alertChannel);
        }
    }, [
        open
    ]);
    const handleSave = ()=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["saveSettings"])({
            recipientWallet: recipient,
            alertChannel
        });
        __TURBOPACK__imported__module__$5b$externals$5d2f$sonner__$5b$external$5d$__$28$sonner$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sonner$29$__["toast"].success("Settings saved");
        setOpen(false);
    };
    const modalContent = open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm",
        onClick: ()=>setOpen(false),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
            className: "bg-card w-full max-w-md rounded-2xl border border-border/60 shadow-2xl animate-in fade-in zoom-in-95 duration-200",
            onClick: (e)=>e.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between p-5 border-b border-border/40",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                    className: "w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"], {
                                        className: "h-5 w-5 text-primary"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/SettingsDialog.tsx",
                                        lineNumber: 41,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                    lineNumber: 40,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("h2", {
                                    className: "font-semibold",
                                    children: "Settings"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                    lineNumber: 43,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/SettingsDialog.tsx",
                            lineNumber: 39,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                            onClick: ()=>setOpen(false),
                            className: "p-1 hover:bg-muted rounded-lg",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/SettingsDialog.tsx",
                                lineNumber: 46,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/SettingsDialog.tsx",
                            lineNumber: 45,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/SettingsDialog.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                    className: "p-5 space-y-5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("label", {
                                    className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                            className: "h-3.5 w-3.5"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/SettingsDialog.tsx",
                                            lineNumber: 54,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        "Default Recipient Wallet"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                    lineNumber: 53,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    value: recipient,
                                    onChange: (e)=>setRecipient(e.target.value),
                                    className: "w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                    lineNumber: 57,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/SettingsDialog.tsx",
                            lineNumber: 52,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("label", {
                                    className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__["Bell"], {
                                            className: "h-3.5 w-3.5"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/SettingsDialog.tsx",
                                            lineNumber: 67,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        "Alert Channel"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                    lineNumber: 66,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                                    className: "relative w-full",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("select", {
                                            value: alertChannel,
                                            onChange: (e)=>setAlertChannel(e.target.value),
                                            className: "w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm appearance-none cursor-pointer pr-10",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("option", {
                                                    value: "app",
                                                    children: "In-App Notification"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 77,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("option", {
                                                    value: "email",
                                                    children: "Email"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 78,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("option", {
                                                    value: "telegram",
                                                    children: "Telegram"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 79,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("option", {
                                                    value: "discord",
                                                    children: "Discord"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 80,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/SettingsDialog.tsx",
                                            lineNumber: 72,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                                            className: "absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/SettingsDialog.tsx",
                                            lineNumber: 82,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                    lineNumber: 71,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/SettingsDialog.tsx",
                            lineNumber: 65,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/SettingsDialog.tsx",
                    lineNumber: 51,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                    className: "p-5 border-t border-border/40",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                        onClick: handleSave,
                        className: "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__["Save"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/SettingsDialog.tsx",
                                lineNumber: 93,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            "Save Settings"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/SettingsDialog.tsx",
                        lineNumber: 89,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/src/components/SettingsDialog.tsx",
                    lineNumber: 88,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/SettingsDialog.tsx",
            lineNumber: 33,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/SettingsDialog.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                onClick: ()=>setOpen(true),
                className: "p-2 rounded-full border border-border hover:bg-muted transition-colors",
                title: "Settings",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/src/components/SettingsDialog.tsx",
                    lineNumber: 108,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/SettingsDialog.tsx",
                lineNumber: 103,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            mounted ? /*#__PURE__*/ __TURBOPACK__imported__module__$5b$externals$5d2f$react$2d$dom__$5b$external$5d$__$28$react$2d$dom$2c$__cjs$29$__["default"].createPortal(modalContent, document.body) : null
        ]
    }, void 0, true);
};
const __TURBOPACK__default__export__ = SettingsDialog;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/components/Header.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react [external] (react, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/router.js [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [ssr] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$OnchainWorkflowsSheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/OnchainWorkflowsSheet.tsx [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$SettingsDialog$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/SettingsDialog.tsx [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$OnchainWorkflowsSheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$SettingsDialog$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$OnchainWorkflowsSheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$SettingsDialog$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
;
const Header = ()=>{
    const [name, setName] = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useState"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["getScenarioName"])());
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react__$5b$external$5d$__$28$react$2c$__cjs$29$__["useEffect"])(()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
    }, []);
    const handleNameChange = (e)=>{
        const val = e.target.value;
        setName(val);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["setScenarioName"])(val);
    };
    const handleNew = ()=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["setFlowNodes"])([]);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$ssr$5d$__$28$ecmascript$29$__["setScenarioName"])("New Scenario");
        router.push("/dashboard");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
        className: "h-16 bg-background border-b border-border flex items-center justify-between px-6 z-20",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("input", {
                        type: "text",
                        value: name,
                        onChange: handleNameChange,
                        placeholder: "Scenario name...",
                        className: "text-lg font-semibold bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 rounded transition-colors w-48 md:w-64"
                    }, void 0, false, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                        onClick: handleNew,
                        className: "flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors border border-border/40",
                        title: "Create a new workflow",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                className: "h-3.5 w-3.5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Header.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("span", {
                                children: "New"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Header.tsx",
                                lineNumber: 50,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 44,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("button", {
                        onClick: ()=>router.push("/"),
                        className: "ai-button text-xs px-3.5 py-1.5 flex items-center gap-1",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("span", {
                            children: "AI Builder"
                        }, void 0, false, {
                            fileName: "[project]/src/components/Header.tsx",
                            lineNumber: 59,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$SettingsDialog$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 61,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$OnchainWorkflowsSheet$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                        fileName: "[project]/src/components/Header.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Header.tsx",
                lineNumber: 54,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Header.tsx",
        lineNumber: 35,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
const __TURBOPACK__default__export__ = Header;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/components/Navbar.tsx [ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/react/jsx-dev-runtime [external] (react/jsx-dev-runtime, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$WalletButton$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/WalletButton.tsx [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__ = __turbopack_context__.i("[externals]/@solana/wallet-adapter-react [external] (@solana/wallet-adapter-react, esm_import, [project]/node_modules/@solana/wallet-adapter-react)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$link$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/link.js [ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [ssr] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Header.tsx [ssr] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$WalletButton$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$WalletButton$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
;
const Navbar = ()=>{
    const { connected } = (0, __TURBOPACK__imported__module__$5b$externals$5d2f40$solana$2f$wallet$2d$adapter$2d$react__$5b$external$5d$__$2840$solana$2f$wallet$2d$adapter$2d$react$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$29$__["useWallet"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("header", {
        className: "relative z-10 flex items-center justify-between px-8 py-4 border-b border-border/10 shrink-0 bg-background/80 backdrop-blur-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$link$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__["default"], {
                href: "/",
                className: "flex items-center gap-3 group",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("div", {
                        className: "w-9 h-9 rounded-xl bg-gradient-purple-cyan flex items-center justify-center group-hover:opacity-90 transition-opacity",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                            className: "h-5 w-5 text-white"
                        }, void 0, false, {
                            fileName: "[project]/src/components/Navbar.tsx",
                            lineNumber: 14,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/Navbar.tsx",
                        lineNumber: 13,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("span", {
                        className: "text-xl font-bold gradient-text",
                        children: "Solana Workflow"
                    }, void 0, false, {
                        fileName: "[project]/src/components/Navbar.tsx",
                        lineNumber: 16,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Navbar.tsx",
                lineNumber: 12,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            connected && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/src/components/Navbar.tsx",
                lineNumber: 18,
                columnNumber: 23
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])("nav", {
                className: "flex items-center gap-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$link$2e$js__$5b$ssr$5d$__$28$ecmascript$29$__["default"], {
                        href: "/documentation",
                        className: "text-sm font-medium text-foreground hover:underline",
                        children: "Documentación"
                    }, void 0, false, {
                        fileName: "[project]/src/components/Navbar.tsx",
                        lineNumber: 20,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$externals$5d2f$react$2f$jsx$2d$dev$2d$runtime__$5b$external$5d$__$28$react$2f$jsx$2d$dev$2d$runtime$2c$__cjs$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$WalletButton$2e$tsx__$5b$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                        fileName: "[project]/src/components/Navbar.tsx",
                        lineNumber: 23,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Navbar.tsx",
                lineNumber: 19,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Navbar.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
const __TURBOPACK__default__export__ = Navbar;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/src/components/Navbar.tsx [ssr] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/Navbar.tsx [ssr] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1rj492a._.js.map