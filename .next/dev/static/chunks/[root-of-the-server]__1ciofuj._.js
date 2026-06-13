(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[turbopack]/browser/dev/hmr-client/hmr-client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="../../../shared/runtime/runtime-types.d.ts" />
/// <reference path="../../../shared/runtime/dev-globals.d.ts" />
/// <reference path="../../../shared/runtime/dev-protocol.d.ts" />
/// <reference path="../../../shared/runtime/dev-extensions.ts" />
__turbopack_context__.s([
    "connect",
    ()=>connect,
    "setHooks",
    ()=>setHooks,
    "subscribeToUpdate",
    ()=>subscribeToUpdate
]);
function connect({ addMessageListener, sendMessage, onUpdateError = console.error }) {
    addMessageListener((msg)=>{
        switch(msg.type){
            case 'turbopack-connected':
                handleSocketConnected(sendMessage);
                break;
            default:
                try {
                    if (Array.isArray(msg.data)) {
                        for(let i = 0; i < msg.data.length; i++){
                            handleSocketMessage(msg.data[i]);
                        }
                    } else {
                        handleSocketMessage(msg.data);
                    }
                    applyAggregatedUpdates();
                } catch (e) {
                    console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
                    onUpdateError(e);
                    location.reload();
                }
                break;
        }
    });
    const queued = globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS;
    if (queued != null && !Array.isArray(queued)) {
        throw new Error('A separate HMR handler was already registered');
    }
    globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS = {
        push: ([chunkPath, callback])=>{
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    };
    if (Array.isArray(queued)) {
        for (const [chunkPath, callback] of queued){
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    }
}
const updateCallbackSets = new Map();
function sendJSON(sendMessage, message) {
    sendMessage(JSON.stringify(message));
}
function resourceKey(resource) {
    return JSON.stringify({
        path: resource.path,
        headers: resource.headers || null
    });
}
function subscribeToUpdates(sendMessage, resource) {
    sendJSON(sendMessage, {
        type: 'turbopack-subscribe',
        ...resource
    });
    return ()=>{
        sendJSON(sendMessage, {
            type: 'turbopack-unsubscribe',
            ...resource
        });
    };
}
function handleSocketConnected(sendMessage) {
    for (const key of updateCallbackSets.keys()){
        subscribeToUpdates(sendMessage, JSON.parse(key));
    }
}
// we aggregate all pending updates until the issues are resolved
const chunkListsWithPendingUpdates = new Map();
function aggregateUpdates(msg) {
    const key = resourceKey(msg.resource);
    let aggregated = chunkListsWithPendingUpdates.get(key);
    if (aggregated) {
        aggregated.instruction = mergeChunkListUpdates(aggregated.instruction, msg.instruction);
    } else {
        chunkListsWithPendingUpdates.set(key, msg);
    }
}
function applyAggregatedUpdates() {
    if (chunkListsWithPendingUpdates.size === 0) return;
    hooks.beforeRefresh();
    for (const msg of chunkListsWithPendingUpdates.values()){
        triggerUpdate(msg);
    }
    chunkListsWithPendingUpdates.clear();
    finalizeUpdate();
}
function mergeChunkListUpdates(updateA, updateB) {
    let chunks;
    if (updateA.chunks != null) {
        if (updateB.chunks == null) {
            chunks = updateA.chunks;
        } else {
            chunks = mergeChunkListChunks(updateA.chunks, updateB.chunks);
        }
    } else if (updateB.chunks != null) {
        chunks = updateB.chunks;
    }
    let merged;
    if (updateA.merged != null) {
        if (updateB.merged == null) {
            merged = updateA.merged;
        } else {
            // Since `merged` is an array of updates, we need to merge them all into
            // one, consistent update.
            // Since there can only be `EcmascriptMergeUpdates` in the array, there is
            // no need to key on the `type` field.
            let update = updateA.merged[0];
            for(let i = 1; i < updateA.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateA.merged[i]);
            }
            for(let i = 0; i < updateB.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateB.merged[i]);
            }
            merged = [
                update
            ];
        }
    } else if (updateB.merged != null) {
        merged = updateB.merged;
    }
    return {
        type: 'ChunkListUpdate',
        chunks,
        merged
    };
}
function mergeChunkListChunks(chunksA, chunksB) {
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    return chunks;
}
function mergeChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted' || updateA.type === 'deleted' && updateB.type === 'added') {
        return undefined;
    }
    if (updateB.type === 'total') {
        // A total update replaces the entire chunk, so it supersedes any prior update.
        return updateB;
    }
    if (updateA.type === 'partial') {
        invariant(updateA.instruction, 'Partial updates are unsupported');
    }
    if (updateB.type === 'partial') {
        invariant(updateB.instruction, 'Partial updates are unsupported');
    }
    return undefined;
}
function mergeChunkListEcmascriptMergedUpdates(mergedA, mergedB) {
    const entries = mergeEcmascriptChunkEntries(mergedA.entries, mergedB.entries);
    const chunks = mergeEcmascriptChunksUpdates(mergedA.chunks, mergedB.chunks);
    return {
        type: 'EcmascriptMergedUpdate',
        entries,
        chunks
    };
}
function mergeEcmascriptChunkEntries(entriesA, entriesB) {
    return {
        ...entriesA,
        ...entriesB
    };
}
function mergeEcmascriptChunksUpdates(chunksA, chunksB) {
    if (chunksA == null) {
        return chunksB;
    }
    if (chunksB == null) {
        return chunksA;
    }
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeEcmascriptChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    if (Object.keys(chunks).length === 0) {
        return undefined;
    }
    return chunks;
}
function mergeEcmascriptChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted') {
        // These two completely cancel each other out.
        return undefined;
    }
    if (updateA.type === 'deleted' && updateB.type === 'added') {
        const added = [];
        const deleted = [];
        const deletedModules = new Set(updateA.modules ?? []);
        const addedModules = new Set(updateB.modules ?? []);
        for (const moduleId of addedModules){
            if (!deletedModules.has(moduleId)) {
                added.push(moduleId);
            }
        }
        for (const moduleId of deletedModules){
            if (!addedModules.has(moduleId)) {
                deleted.push(moduleId);
            }
        }
        if (added.length === 0 && deleted.length === 0) {
            return undefined;
        }
        return {
            type: 'partial',
            added,
            deleted
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'partial') {
        const added = new Set([
            ...updateA.added ?? [],
            ...updateB.added ?? []
        ]);
        const deleted = new Set([
            ...updateA.deleted ?? [],
            ...updateB.deleted ?? []
        ]);
        if (updateB.added != null) {
            for (const moduleId of updateB.added){
                deleted.delete(moduleId);
            }
        }
        if (updateB.deleted != null) {
            for (const moduleId of updateB.deleted){
                added.delete(moduleId);
            }
        }
        return {
            type: 'partial',
            added: [
                ...added
            ],
            deleted: [
                ...deleted
            ]
        };
    }
    if (updateA.type === 'added' && updateB.type === 'partial') {
        const modules = new Set([
            ...updateA.modules ?? [],
            ...updateB.added ?? []
        ]);
        for (const moduleId of updateB.deleted ?? []){
            modules.delete(moduleId);
        }
        return {
            type: 'added',
            modules: [
                ...modules
            ]
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'deleted') {
        // We could eagerly return `updateB` here, but this would potentially be
        // incorrect if `updateA` has added modules.
        const modules = new Set(updateB.modules ?? []);
        if (updateA.added != null) {
            for (const moduleId of updateA.added){
                modules.delete(moduleId);
            }
        }
        return {
            type: 'deleted',
            modules: [
                ...modules
            ]
        };
    }
    // Any other update combination is invalid.
    return undefined;
}
function invariant(_, message) {
    throw new Error(`Invariant: ${message}`);
}
const CRITICAL = [
    'bug',
    'error',
    'fatal'
];
function compareByList(list, a, b) {
    const aI = list.indexOf(a) + 1 || list.length;
    const bI = list.indexOf(b) + 1 || list.length;
    return aI - bI;
}
const chunksWithIssues = new Map();
function emitIssues() {
    const issues = [];
    const deduplicationSet = new Set();
    for (const [_, chunkIssues] of chunksWithIssues){
        for (const chunkIssue of chunkIssues){
            if (deduplicationSet.has(chunkIssue.formatted)) continue;
            issues.push(chunkIssue);
            deduplicationSet.add(chunkIssue.formatted);
        }
    }
    sortIssues(issues);
    hooks.issues(issues);
}
function handleIssues(msg) {
    const key = resourceKey(msg.resource);
    let hasCriticalIssues = false;
    for (const issue of msg.issues){
        if (CRITICAL.includes(issue.severity)) {
            hasCriticalIssues = true;
        }
    }
    if (msg.issues.length > 0) {
        chunksWithIssues.set(key, msg.issues);
    } else if (chunksWithIssues.has(key)) {
        chunksWithIssues.delete(key);
    }
    emitIssues();
    return hasCriticalIssues;
}
const SEVERITY_ORDER = [
    'bug',
    'fatal',
    'error',
    'warning',
    'info',
    'log'
];
const CATEGORY_ORDER = [
    'parse',
    'resolve',
    'code generation',
    'rendering',
    'typescript',
    'other'
];
function sortIssues(issues) {
    issues.sort((a, b)=>{
        const first = compareByList(SEVERITY_ORDER, a.severity, b.severity);
        if (first !== 0) return first;
        return compareByList(CATEGORY_ORDER, a.category, b.category);
    });
}
const hooks = {
    beforeRefresh: ()=>{},
    refresh: ()=>{},
    buildOk: ()=>{},
    issues: (_issues)=>{}
};
function setHooks(newHooks) {
    Object.assign(hooks, newHooks);
}
function handleSocketMessage(msg) {
    sortIssues(msg.issues);
    handleIssues(msg);
    switch(msg.type){
        case 'issues':
            break;
        case 'partial':
            // aggregate updates
            aggregateUpdates(msg);
            break;
        default:
            // run single update
            const runHooks = chunkListsWithPendingUpdates.size === 0;
            if (runHooks) hooks.beforeRefresh();
            triggerUpdate(msg);
            if (runHooks) finalizeUpdate();
            break;
    }
}
function finalizeUpdate() {
    hooks.refresh();
    hooks.buildOk();
    // This is used by the Next.js integration test suite to notify it when HMR
    // updates have been completed.
    // TODO: Only run this in test environments (gate by `process.env.__NEXT_TEST_MODE`)
    if (globalThis.__NEXT_HMR_CB) {
        globalThis.__NEXT_HMR_CB();
        globalThis.__NEXT_HMR_CB = null;
    }
}
function subscribeToChunkUpdate(chunkListPath, sendMessage, callback) {
    return subscribeToUpdate({
        path: chunkListPath
    }, sendMessage, callback);
}
function subscribeToUpdate(resource, sendMessage, callback) {
    const key = resourceKey(resource);
    let callbackSet;
    const existingCallbackSet = updateCallbackSets.get(key);
    if (!existingCallbackSet) {
        callbackSet = {
            callbacks: new Set([
                callback
            ]),
            unsubscribe: subscribeToUpdates(sendMessage, resource)
        };
        updateCallbackSets.set(key, callbackSet);
    } else {
        existingCallbackSet.callbacks.add(callback);
        callbackSet = existingCallbackSet;
    }
    return ()=>{
        callbackSet.callbacks.delete(callback);
        if (callbackSet.callbacks.size === 0) {
            callbackSet.unsubscribe();
            updateCallbackSets.delete(key);
        }
    };
}
function triggerUpdate(msg) {
    const key = resourceKey(msg.resource);
    const callbackSet = updateCallbackSets.get(key);
    if (!callbackSet) {
        return;
    }
    for (const callback of callbackSet.callbacks){
        callback(msg);
    }
    if (msg.type === 'notFound') {
        // This indicates that the resource which we subscribed to either does not exist or
        // has been deleted. In either case, we should clear all update callbacks, so if a
        // new subscription is created for the same resource, it will send a new "subscribe"
        // message to the server.
        // No need to send an "unsubscribe" message to the server, it will have already
        // dropped the update stream before sending the "notFound" message.
        updateCallbackSets.delete(key);
    }
}
}),
"[project]/src/integrations/supabase/client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
// This file is automatically generated. Do not edit it directly.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [client] (ecmascript) <locals>");
;
const SUPABASE_URL = ("TURBOPACK compile-time value", "https://hessksbxjcfkmujiqhnr.supabase.co");
const SUPABASE_PUBLISHABLE_KEY = ("TURBOPACK compile-time value", "sb_publishable_FmQ2Cfd_Y--n4Yc05IeUfw_UFMXnB1c");
const isBrowser = ("TURBOPACK compile-time value", "object") !== "undefined";
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        storage: ("TURBOPACK compile-time truthy", 1) ? localStorage : "TURBOPACK unreachable",
        persistSession: true,
        autoRefreshToken: true
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/workflowStore.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflow.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/integrations/supabase/client.ts [client] (ecmascript)");
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
    const wf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["nodesToWorkflow"])(scenarioName, flowNodes);
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
            const { data, error: invokeError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["supabase"].functions.invoke(endpoint, {
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
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["supabase"].functions.invoke('delete-ipfs-file', {
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
    const PINATA_JWT = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_PINATA_JWT;
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
        const freshNodes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["workflowToNodes"])(cleanWorkflowJson);
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/workflow.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/activity.js [client] (ecmascript) <export default as Activity>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bell.js [client] (ecmascript) <export default as Bell>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$braces$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Braces$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/braces.js [client] (ecmascript) <export default as Braces>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock.js [client] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.js [client] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$line$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LineChart$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chart-line.js [client] (ecmascript) <export default as LineChart>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [client] (ecmascript) <export default as Send>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$webhook$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Webhook$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/webhook.js [client] (ecmascript) <export default as Webhook>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2d$right$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeftRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left-right.js [client] (ecmascript) <export default as ArrowLeftRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [client] (ecmascript)");
;
;
const TRIGGER_MODULES = [
    {
        type: "price_monitor",
        kind: "trigger",
        name: "Price Monitor",
        description: "Triggers on token price",
        color: "#14F195",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$line$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LineChart$3e$__["LineChart"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__["Activity"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$webhook$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Webhook$3e$__["Webhook"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__["Bell"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2d$right$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeftRight$3e$__["ArrowLeftRight"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"],
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
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$braces$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Braces$3e$__["Braces"],
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
    const settings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSettings"])();
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/pages/index.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-right.js [client] (ecmascript) <export default as ArrowRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/integrations/supabase/client.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2f$lib$2f$esm$2f$useWallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@solana/wallet-adapter-react/lib/esm/useWallet.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2f$lib$2f$esm$2f$useWalletModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@solana/wallet-adapter-react-ui/lib/esm/useWalletModal.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/router.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflow.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
;
;
const EXAMPLES = [
    "Si el precio de SOL sube por arriba de $60, transfiere 1 USDC a mi recipient",
    "Cada 15 minutos consulta el par BONK/SOL en DexScreener y mándame una alerta si el volumen sube de $100k",
    "Cuando llegue un webhook, haz un swap de 1 SOL a USDC en Jupiter",
    "Si JUP sube por encima de $1.20, envíame una notificación"
];
const Landing = ()=>{
    _s();
    const [prompt, setPrompt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { connected } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2f$lib$2f$esm$2f$useWallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useWallet"])();
    const { setVisible } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2f$lib$2f$esm$2f$useWalletModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useWalletModal"])();
    const ensureWalletConnected = ()=>{
        if (!connected) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error("Por favor, conecta tu billetera para continuar");
            setVisible(true);
            return false;
        }
        return true;
    };
    const generate = async (text)=>{
        if (!ensureWalletConnected()) return;
        if (!text.trim()) return;
        setLoading(true);
        try {
            const settings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSettings"])();
            const contextPrompt = settings.recipientWallet ? `${text}\n\n[Context: default recipient wallet is ${settings.recipientWallet}, default alert channel is ${settings.alertChannel}]` : text;
            const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["supabase"].functions.invoke("generate-workflow", {
                body: {
                    prompt: contextPrompt
                }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            if (!data?.workflow) throw new Error("No workflow returned");
            const wf = data.workflow;
            console.log("JSON generado por la IA:", JSON.stringify(wf, null, 2));
            // Directly load generated workflow to canvas nodes
            const nodes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["workflowToNodes"])(wf);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])(nodes);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setScenarioName"])(wf.name || "My Scenario");
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success("Workflow generated & loaded!");
            router.push("/dashboard");
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error(e.message || "Failed to generate");
        } finally{
            setLoading(false);
        }
    };
    const startEmpty = ()=>{
        if (!ensureWalletConnected()) return;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])([]);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setScenarioName"])("New Scenario");
        router.push("/dashboard");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-screen w-screen bg-background relative overflow-hidden flex flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "landing-orb landing-orb-1"
            }, void 0, false, {
                fileName: "[project]/src/pages/index.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "landing-orb landing-orb-2"
            }, void 0, false, {
                fileName: "[project]/src/pages/index.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "landing-orb landing-orb-3"
            }, void 0, false, {
                fileName: "[project]/src/pages/index.tsx",
                lineNumber: 83,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-h-[calc(100vh-70px)] py-4 overflow-y-auto",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full max-w-2xl flex flex-col justify-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-center mb-4 md:mb-5",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold tracking-wide",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                        className: "h-3.5 w-3.5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/index.tsx",
                                        lineNumber: 94,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    "AI-POWERED WORKFLOW BUILDER"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/index.tsx",
                                lineNumber: 93,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 92,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-4xl md:text-5xl font-extrabold text-center mb-3 leading-tight tracking-tight",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "gradient-text",
                                    children: "¿Qué quieres"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 101,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 102,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-foreground",
                                    children: "automatizar?"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 103,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 100,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-center text-muted-foreground text-sm md:text-base mb-6 max-w-md mx-auto",
                            children: "Describe tu flujo en lenguaje natural — la IA lo convertirá en un workflow visual editable en Solana."
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 105,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "landing-glass rounded-2xl p-2.5 flex flex-col bg-card/85 backdrop-blur-sm border border-border/40 shadow-xl",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    id: "promptBox",
                                    value: prompt,
                                    onChange: (e)=>setPrompt(e.target.value),
                                    placeholder: "Ej: Si el precio de SOL baja a $60, transfiere 1 SOL a mi recipient...",
                                    rows: 3,
                                    disabled: loading,
                                    className: "w-full bg-transparent border-0 resize-none focus:outline-none text-sm placeholder:text-muted-foreground/60 p-2 text-foreground",
                                    onKeyDown: (e)=>{
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                            e.preventDefault();
                                            generate(prompt);
                                        }
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 111,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between border-t border-border/10 pt-2.5 mt-1 px-1.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[10px] md:text-[11px] text-muted-foreground/50 select-none",
                                            children: "Presiona Ctrl + Enter para generar"
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/index.tsx",
                                            lineNumber: 126,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>generate(prompt),
                                            disabled: loading || !prompt.trim(),
                                            className: "ai-button flex items-center gap-2 disabled:opacity-40 text-xs py-1.5 px-4 font-semibold shrink-0",
                                            children: [
                                                loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                    className: "h-3.5 w-3.5 animate-spin"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/index.tsx",
                                                    lineNumber: 135,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                                    className: "h-3.5 w-3.5"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/index.tsx",
                                                    lineNumber: 137,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                "Generate"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/index.tsx",
                                            lineNumber: 129,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 125,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 110,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-6 md:mt-7",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2.5 text-center font-medium",
                                    children: "Prueba con un ejemplo"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 146,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid sm:grid-cols-2 gap-2.5",
                                    children: EXAMPLES.map((ex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>{
                                                setPrompt(ex);
                                                generate(ex);
                                            },
                                            disabled: loading,
                                            className: "text-left p-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm hover:border-primary/40 hover:bg-card/70 transition-all duration-300 text-xs flex items-start gap-2.5 disabled:opacity-40 group",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                                                    className: "h-3.5 w-3.5 mt-0.5 shrink-0 text-primary opacity-50 group-hover:opacity-100 transition-opacity"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/index.tsx",
                                                    lineNumber: 160,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2",
                                                    children: ex
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/index.tsx",
                                                    lineNumber: 161,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, ex, true, {
                                            fileName: "[project]/src/pages/index.tsx",
                                            lineNumber: 151,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)))
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/index.tsx",
                                    lineNumber: 149,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 145,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-center mt-5 md:mt-6",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: startEmpty,
                                disabled: loading,
                                className: "text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors",
                                children: "o empieza con un canvas vacío →"
                            }, void 0, false, {
                                fileName: "[project]/src/pages/index.tsx",
                                lineNumber: 171,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/pages/index.tsx",
                            lineNumber: 170,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/pages/index.tsx",
                    lineNumber: 89,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/pages/index.tsx",
                lineNumber: 88,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/pages/index.tsx",
        lineNumber: 79,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(Landing, "7gilJdNDqCZc27ZDUlZGTaDj0jU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2f$lib$2f$esm$2f$useWallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useWallet"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2d$ui$2f$lib$2f$esm$2f$useWalletModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useWalletModal"]
    ];
});
_c = Landing;
const __TURBOPACK__default__export__ = Landing;
var _c;
__turbopack_context__.k.register(_c, "Landing");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/index.tsx [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/src/pages/index.tsx [client] (ecmascript)");
    }
]);
// @ts-expect-error module.hot exists
if ("TURBOPACK compile-time truthy", 1) {
    // @ts-expect-error module.hot exists
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}
}),
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/src/pages/index\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/index.tsx [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__1ciofuj._.js.map