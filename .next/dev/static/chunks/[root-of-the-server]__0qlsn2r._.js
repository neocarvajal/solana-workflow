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
"[project]/src/components/Sidebar.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/router.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/house.js [client] (ecmascript) <export default as Home>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$code$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileCode$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-code.js [client] (ecmascript) <export default as FileCode>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$plus$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FilePlus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-plus.js [client] (ecmascript) <export default as FilePlus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Folder$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/folder.js [client] (ecmascript) <export default as Folder>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/link.js [client] (ecmascript) <export default as Link>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$ellipsis$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MoreHorizontal$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/ellipsis.js [client] (ecmascript) <export default as MoreHorizontal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Book$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book.js [client] (ecmascript) <export default as Book>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bell.js [client] (ecmascript) <export default as Bell>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$help$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__HelpCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-help.js [client] (ecmascript) <export default as HelpCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [client] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/menu.js [client] (ecmascript) <export default as Menu>");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
const NavItem = ({ icon: Icon, label, active = false, onClick, hasDropdown = false, isExpanded })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `sidebar-item ${active ? 'active' : ''} cursor-pointer flex items-center ${isExpanded ? 'gap-2 px-3 py-2 justify-start' : 'justify-center py-2.5'}`,
        onClick: onClick,
        title: !isExpanded ? label : undefined,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                className: "h-5 w-5 shrink-0"
            }, void 0, false, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            isExpanded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex-1 whitespace-nowrap overflow-hidden text-ellipsis",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 43,
                columnNumber: 22
            }, ("TURBOPACK compile-time value", void 0)),
            isExpanded && hasDropdown && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                className: "h-4 w-4 shrink-0"
            }, void 0, false, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 44,
                columnNumber: 37
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Sidebar.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = NavItem;
const Sidebar = ()=>{
    _s();
    // Collapsed by default as requested: "El panel izquierdo debe iniciar retraido"
    const [isExpanded, setIsExpanded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const isScenariosActive = router.pathname === '/dashboard';
    const isOrgActive = router.pathname === '/dashboard/workflows';
    const isDocActive = router.pathname === '/documentation';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `h-screen bg-solana-purple flex flex-col text-white transition-all duration-300 select-none ${isExpanded ? 'w-64' : 'w-16'}`,
        children: [
            isExpanded ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4 flex items-center justify-between border-b border-white/5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-7 w-7 text-white shrink-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                    viewBox: "0 0 24 24",
                                    fill: "none",
                                    xmlns: "http://www.w3.org/2000/svg",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            d: "M3 9L12 5L21 9L12 13L3 9Z",
                                            stroke: "currentColor",
                                            strokeWidth: "2",
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 67,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            d: "M3 14L12 10L21 14L12 18L3 14Z",
                                            stroke: "currentColor",
                                            strokeWidth: "2",
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 68,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            d: "M3 19L12 15L21 19",
                                            stroke: "currentColor",
                                            strokeWidth: "2",
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/Sidebar.tsx",
                                            lineNumber: 69,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/Sidebar.tsx",
                                    lineNumber: 66,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 65,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-bold text-base gradient-text whitespace-nowrap",
                                children: "SOLANA FLOWS"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 72,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 64,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setIsExpanded(false),
                        className: "p-1 hover:bg-white/10 rounded-lg transition-colors",
                        title: "Collapse sidebar",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
                            className: "h-5 w-5 text-white"
                        }, void 0, false, {
                            fileName: "[project]/src/components/Sidebar.tsx",
                            lineNumber: 79,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 74,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 63,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4 flex items-center justify-center border-b border-white/5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: ()=>setIsExpanded(true),
                    className: "p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center",
                    title: "Expand sidebar",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
                        className: "h-5 w-5 text-white"
                    }, void 0, false, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 89,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/src/components/Sidebar.tsx",
                    lineNumber: 84,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 83,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 overflow-y-auto overflow-x-hidden py-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-3",
                        children: [
                            isExpanded ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50",
                                children: "MY ORGANIZATION"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 99,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
                                className: "border-white/10 my-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 101,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"],
                                label: "Home",
                                active: router.pathname === '/',
                                isExpanded: isExpanded,
                                onClick: ()=>router.push('/')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 103,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Folder$3e$__["Folder"],
                                label: "My Workflows",
                                active: isOrgActive,
                                isExpanded: isExpanded,
                                onClick: ()=>router.push('/dashboard/workflows')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 110,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 97,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-3 mt-4",
                        children: [
                            isExpanded ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mb-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold opacity-50",
                                children: "MY TEAM"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 122,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
                                className: "border-white/10 my-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 124,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"],
                                label: "Team",
                                isExpanded: isExpanded,
                                onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info('Team management coming soon!')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 126,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$plus$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FilePlus$3e$__["FilePlus"],
                                label: "Scenarios",
                                active: isScenariosActive,
                                isExpanded: isExpanded,
                                onClick: ()=>router.push('/dashboard')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 127,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$code$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileCode$3e$__["FileCode"],
                                label: "Templates",
                                isExpanded: isExpanded,
                                onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info('Templates coming soon!')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 134,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Link$3e$__["Link"],
                                label: "Connections",
                                isExpanded: isExpanded,
                                onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info('Connections coming soon!')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 135,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$ellipsis$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MoreHorizontal$3e$__["MoreHorizontal"],
                                label: "More",
                                hasDropdown: true,
                                isExpanded: isExpanded
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 136,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 120,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-8 px-3",
                        children: [
                            !isExpanded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("hr", {
                                className: "border-white/10 my-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 141,
                                columnNumber: 27
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Book$3e$__["Book"],
                                label: "Documentation",
                                active: isDocActive,
                                isExpanded: isExpanded,
                                onClick: ()=>router.push('/documentation')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 142,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__["Bell"],
                                label: "What's New",
                                isExpanded: isExpanded,
                                onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info("What's new coming soon!")
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 149,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NavItem, {
                                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$help$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__HelpCircle$3e$__["HelpCircle"],
                                label: "Help",
                                isExpanded: isExpanded,
                                onClick: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info('Help center coming soon!')
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 150,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 140,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 95,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `p-3 border-t border-white/10 flex items-center ${isExpanded ? 'gap-2.5 justify-start' : 'justify-center'}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-8 w-8 rounded-full bg-solana-cyan flex items-center justify-center text-solana-dark font-bold shrink-0",
                        children: "S"
                    }, void 0, false, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 156,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    isExpanded && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis leading-none",
                                children: "Solana User"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 161,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] opacity-50 leading-none mt-1",
                                children: "user@solana.com"
                            }, void 0, false, {
                                fileName: "[project]/src/components/Sidebar.tsx",
                                lineNumber: 162,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/Sidebar.tsx",
                        lineNumber: 160,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Sidebar.tsx",
                lineNumber: 155,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Sidebar.tsx",
        lineNumber: 59,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(Sidebar, "PAN5oR5p6A/nyyuZSuOVIDJL9cY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c1 = Sidebar;
const __TURBOPACK__default__export__ = Sidebar;
var _c, _c1;
__turbopack_context__.k.register(_c, "NavItem");
__turbopack_context__.k.register(_c1, "Sidebar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/NodeSettingsModal.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.js [client] (ecmascript) <export default as Trash2>");
;
var _s = __turbopack_context__.k.signature();
;
;
const MODULE_FIELDS = {
    /* ── Triggers ──────────────────────────── */ price_monitor: [
        {
            key: "asset",
            label: "Asset",
            type: "select",
            description: "Token to monitor",
            options: [
                {
                    value: "SOL",
                    label: "SOL"
                },
                {
                    value: "BONK",
                    label: "BONK"
                },
                {
                    value: "JUP",
                    label: "JUP"
                },
                {
                    value: "RAY",
                    label: "RAY"
                },
                {
                    value: "WIF",
                    label: "WIF"
                }
            ]
        },
        {
            key: "condition",
            label: "Condition",
            type: "select",
            description: "When to fire",
            options: [
                {
                    value: "above",
                    label: "Price goes above"
                },
                {
                    value: "below",
                    label: "Price goes below"
                },
                {
                    value: "change_pct",
                    label: "% change exceeds"
                }
            ]
        },
        {
            key: "value",
            label: "Threshold Value",
            type: "number",
            placeholder: "e.g. 150",
            description: "USD value or percentage"
        },
        {
            key: "interval",
            label: "Check Interval",
            type: "select",
            description: "How often to poll",
            options: [
                {
                    value: "30s",
                    label: "Every 30 seconds"
                },
                {
                    value: "1m",
                    label: "Every minute"
                },
                {
                    value: "5m",
                    label: "Every 5 minutes"
                },
                {
                    value: "15m",
                    label: "Every 15 minutes"
                }
            ]
        }
    ],
    dexscreener_pair: [
        {
            key: "pairAddress",
            label: "Pair Address",
            type: "text",
            placeholder: "Enter DexScreener pair address",
            description: "The address of the pair to watch"
        },
        {
            key: "apiType",
            label: "API Type",
            type: "select",
            description: "DexScreener endpoint to use",
            options: [
                {
                    value: "pairs",
                    label: "Pairs — /dex/pairs/:chainId/:pairAddresses"
                },
                {
                    value: "tokens",
                    label: "Tokens — /dex/tokens/:tokenAddresses"
                },
                {
                    value: "search",
                    label: "Search — /dex/search/?q=:query"
                }
            ]
        },
        {
            key: "metric",
            label: "Metric",
            type: "select",
            description: "What to watch",
            options: [
                {
                    value: "price",
                    label: "Price (USD)"
                },
                {
                    value: "volume",
                    label: "Volume (24h)"
                },
                {
                    value: "liquidity",
                    label: "Liquidity"
                },
                {
                    value: "priceChange",
                    label: "Price Change %"
                }
            ]
        },
        {
            key: "condition",
            label: "Condition",
            type: "select",
            options: [
                {
                    value: "above",
                    label: "Goes above"
                },
                {
                    value: "below",
                    label: "Goes below"
                }
            ]
        },
        {
            key: "value",
            label: "Threshold",
            type: "number",
            placeholder: "0"
        }
    ],
    schedule: [
        {
            key: "every",
            label: "Run Every",
            type: "select",
            description: "How often the workflow runs",
            options: [
                {
                    value: "1m",
                    label: "Every minute"
                },
                {
                    value: "5m",
                    label: "Every 5 minutes"
                },
                {
                    value: "15m",
                    label: "Every 15 minutes"
                },
                {
                    value: "30m",
                    label: "Every 30 minutes"
                },
                {
                    value: "1h",
                    label: "Every hour"
                },
                {
                    value: "6h",
                    label: "Every 6 hours"
                },
                {
                    value: "24h",
                    label: "Every day"
                }
            ]
        }
    ],
    // webhook: [
    //   { key: "path", label: "Webhook Path", type: "text", placeholder: "/incoming", description: "HTTP endpoint that triggers this workflow" },
    // ],
    webhook: [
        {
            key: "path",
            label: "Webhook Path",
            type: "text",
            placeholder: "/solana-event"
        },
        {
            key: "eventType",
            label: "Event Type",
            type: "select",
            description: "Filter specific blockchain events",
            options: [
                {
                    value: "all",
                    label: "All Activity"
                },
                {
                    value: "transfer",
                    label: "Only Transfers"
                },
                {
                    value: "swap",
                    label: "Only Swaps"
                },
                {
                    value: "nft_mint",
                    label: "NFT Mints"
                }
            ]
        },
        {
            key: "account",
            label: "Monitored Account",
            type: "text",
            placeholder: "Wallet address to watch"
        }
    ],
    /* ── Steps ──────────────────────────── */ send_transaction: [
        {
            key: "to",
            label: "Recipient Wallet",
            type: "text",
            placeholder: "Enter wallet address…",
            description: "Solana address to send to"
        },
        {
            key: "amount",
            label: "Amount",
            type: "number",
            placeholder: "0.1",
            description: "How much to send"
        },
        {
            key: "asset",
            label: "Token",
            type: "select",
            description: "Which token to transfer",
            options: [
                {
                    value: "SOL",
                    label: "SOL"
                },
                {
                    value: "USDC",
                    label: "USDC"
                },
                {
                    value: "BONK",
                    label: "BONK"
                },
                {
                    value: "JUP",
                    label: "JUP"
                }
            ]
        }
    ],
    send_alert: [
        {
            key: "channel",
            label: "Alert Channel",
            type: "select",
            description: "Where to send the alert",
            options: [
                {
                    value: "app",
                    label: "In-App Notification"
                },
                {
                    value: "telegram",
                    label: "Telegram"
                },
                {
                    value: "discord",
                    label: "Discord Webhook"
                },
                {
                    value: "email",
                    label: "Email"
                }
            ]
        },
        {
            key: "message",
            label: "Message",
            type: "textarea",
            placeholder: "Trigger fired! SOL hit $200…",
            description: "Alert message content"
        }
    ],
    swap: [
        {
            key: "from",
            label: "From Token",
            type: "select",
            description: "Token to swap from",
            options: [
                {
                    value: "SOL",
                    label: "SOL"
                },
                {
                    value: "USDC",
                    label: "USDC"
                },
                {
                    value: "BONK",
                    label: "BONK"
                },
                {
                    value: "JUP",
                    label: "JUP"
                },
                {
                    value: "RAY",
                    label: "RAY"
                }
            ]
        },
        {
            key: "to",
            label: "To Token",
            type: "select",
            description: "Token to swap into",
            options: [
                {
                    value: "USDC",
                    label: "USDC"
                },
                {
                    value: "SOL",
                    label: "SOL"
                },
                {
                    value: "BONK",
                    label: "BONK"
                },
                {
                    value: "JUP",
                    label: "JUP"
                }
            ]
        },
        {
            key: "amount",
            label: "Amount",
            type: "number",
            placeholder: "1",
            description: "Amount of the source token to swap"
        },
        {
            key: "slippage",
            label: "Max Slippage %",
            type: "number",
            placeholder: "1",
            description: "Maximum slippage tolerance"
        }
    ],
    http_request: [
        {
            key: "method",
            label: "Method",
            type: "select",
            options: [
                {
                    value: "GET",
                    label: "GET"
                },
                {
                    value: "POST",
                    label: "POST"
                },
                {
                    value: "PUT",
                    label: "PUT"
                },
                {
                    value: "DELETE",
                    label: "DELETE"
                }
            ]
        },
        {
            key: "url",
            label: "URL",
            type: "text",
            placeholder: "https://api.example.com/data"
        },
        {
            key: "body",
            label: "Body (JSON)",
            type: "textarea",
            placeholder: '{ "key": "value" }',
            description: "Request body for POST/PUT"
        }
    ],
    ai_decision: [
        {
            key: "prompt",
            label: "AI Prompt",
            type: "textarea",
            placeholder: "Analyze the data and decide next action.",
            description: "Instruction for the AI agent"
        }
    ],
    dexscreener_lookup: [
        {
            key: "pairAddress",
            label: "Pair Address",
            type: "text",
            placeholder: "Enter pair address…",
            description: "DexScreener pair to look up"
        },
        {
            key: "apiType",
            label: "API Endpoint",
            type: "select",
            description: "Which DexScreener API endpoint to call",
            options: [
                {
                    value: "pairs",
                    label: "Pairs — /dex/pairs/:chainId/:pairAddresses"
                },
                {
                    value: "tokens",
                    label: "Tokens — /dex/tokens/:tokenAddresses"
                },
                {
                    value: "search",
                    label: "Search — /dex/search/?q=:query"
                }
            ]
        }
    ]
};
/* ── Component ───────────────────────────────────────────────── */ const NodeSettingsModal = ({ node, onSave, onClose, onDelete })=>{
    _s();
    const mergeParams = (nodeParams)=>{
        const defaults = node.module.defaultParams || {};
        const incoming = nodeParams || {};
        let merged = {
            ...defaults,
            ...incoming
        };
        if (merged.fromAsset) {
            merged.asset = merged.fromAsset;
            delete merged.fromAsset;
        }
        if (merged.to === undefined || merged.to === null) {
            merged.to = "";
        }
        return merged;
    };
    const [params, setParams] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])({
        "NodeSettingsModal.useState": ()=>mergeParams(node.params)
    }["NodeSettingsModal.useState"]);
    // useEffect(() => {
    //   setParams(mergeParams(node.params));
    // }, [node.id, node.params]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NodeSettingsModal.useEffect": ()=>{
            const cleanParams = mergeParams(node.params);
            setParams(cleanParams);
        }
    }["NodeSettingsModal.useEffect"], [
        node.id,
        JSON.stringify(node.params)
    ]);
    const fields = MODULE_FIELDS[node.module.type] ?? [];
    const handleChange = (key, value)=>{
        setParams((prev)=>({
                ...prev,
                [key]: value
            }));
    };
    const handleSubmit = (e)=>{
        e.preventDefault();
        const finalParams = mergeParams(params);
        console.log("Saving node with final params:", finalParams);
        onSave({
            ...node,
            params: finalParams
        });
    };
    const Icon = node.module.icon;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4",
        onClick: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden",
            onClick: (e)=>e.stopPropagation(),
            style: {
                animation: "fadeIn 0.2s ease-out"
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-3 p-5 border-b border-border/40",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-md",
                            style: {
                                backgroundColor: node.module.color
                            },
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                className: "h-5 w-5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                lineNumber: 262,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                            lineNumber: 258,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-lg font-semibold text-foreground truncate",
                                    children: node.module.name
                                }, void 0, false, {
                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                    lineNumber: 265,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                node.module.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-muted-foreground",
                                    children: node.module.description
                                }, void 0, false, {
                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                    lineNumber: 269,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                            lineNumber: 264,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "p-1.5 rounded-lg hover:bg-muted transition-colors",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-4 w-4 text-muted-foreground"
                            }, void 0, false, {
                                fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                lineNumber: 276,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                            lineNumber: 272,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                    lineNumber: 257,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    onSubmit: handleSubmit,
                    className: "flex-1 overflow-y-auto p-5",
                    children: [
                        fields.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-sm text-muted-foreground text-center py-8",
                            children: "This module has no configurable parameters."
                        }, void 0, false, {
                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                            lineNumber: 283,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-5",
                            children: fields.map((field)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            htmlFor: `field-${field.key}`,
                                            className: "block text-sm font-medium text-foreground mb-1.5",
                                            children: field.label
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 290,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        field.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs text-muted-foreground mb-2",
                                            children: field.description
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 297,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        field.type === "select" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            id: `field-${field.key}`,
                                            value: params[field.key] ?? "",
                                            onChange: (e)=>handleChange(field.key, e.target.value),
                                            className: "w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                                            children: field.options?.map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: opt.value,
                                                    children: opt.label
                                                }, opt.value, false, {
                                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                                    lineNumber: 308,
                                                    columnNumber: 25
                                                }, ("TURBOPACK compile-time value", void 0)))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 301,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0)) : field.type === "textarea" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                            id: `field-${field.key}`,
                                            value: typeof params[field.key] === "object" ? JSON.stringify(params[field.key], null, 2) : params[field.key] ?? "",
                                            onChange: (e)=>{
                                                // Try to parse JSON, fallback to string
                                                try {
                                                    const parsed = JSON.parse(e.target.value);
                                                    handleChange(field.key, parsed);
                                                } catch  {
                                                    handleChange(field.key, e.target.value);
                                                }
                                            },
                                            placeholder: field.placeholder,
                                            rows: 3,
                                            className: "w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all font-mono"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 314,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0)) : field.type === "toggle" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            id: `field-${field.key}`,
                                            onClick: ()=>handleChange(field.key, !params[field.key]),
                                            className: `relative w-11 h-6 rounded-full transition-colors ${params[field.key] ? "bg-primary" : "bg-muted"}`,
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${params[field.key] ? "translate-x-5" : "translate-x-0"}`
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                                lineNumber: 342,
                                                columnNumber: 23
                                            }, ("TURBOPACK compile-time value", void 0))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 335,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            id: `field-${field.key}`,
                                            type: field.type,
                                            value: params[field.key] ?? "",
                                            onChange: (e)=>handleChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value),
                                            placeholder: field.placeholder,
                                            step: field.type === "number" ? "any" : undefined,
                                            className: "w-full px-3 py-2.5 rounded-lg bg-muted/50 border border-border/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 348,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, field.key, true, {
                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                    lineNumber: 289,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, void 0, false, {
                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                            lineNumber: 287,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-end gap-3 mt-6 pt-4 border-t border-border/30",
                            children: [
                                onDelete && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: ()=>onDelete(node.id),
                                    className: "px-4 py-2 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors mr-auto flex items-center gap-2",
                                    title: "Delete node",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 377,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "hidden sm:inline",
                                            children: "Delete"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                            lineNumber: 378,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                    lineNumber: 371,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    onClick: onClose,
                                    className: "px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors",
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                    lineNumber: 381,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "submit",
                                    className: "px-5 py-2 text-sm font-medium text-white rounded-lg bg-gradient-purple-cyan hover:opacity-90 transition-opacity shadow-md",
                                    children: "Save Settings"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                                    lineNumber: 388,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/NodeSettingsModal.tsx",
                            lineNumber: 369,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/NodeSettingsModal.tsx",
                    lineNumber: 281,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/NodeSettingsModal.tsx",
            lineNumber: 251,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/NodeSettingsModal.tsx",
        lineNumber: 247,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(NodeSettingsModal, "mKToad+7313V/xWBpXs4kcvnFA4=");
_c = NodeSettingsModal;
const __TURBOPACK__default__export__ = NodeSettingsModal;
var _c;
__turbopack_context__.k.register(_c, "NodeSettingsModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/DraggableNode.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/settings.js [client] (ecmascript) <export default as Settings>");
;
var _s = __turbopack_context__.k.signature();
;
;
const NODE_RADIUS = 48;
const DraggableNode = ({ node, isFirst, index, scale, isActive, onDrag, onDoubleClick, onSettings })=>{
    _s();
    const isDragging = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const dragOffset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])({
        x: 0,
        y: 0
    });
    const handleMouseDown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DraggableNode.useCallback[handleMouseDown]": (e)=>{
            e.stopPropagation();
            e.preventDefault();
            isDragging.current = true;
            const startX = e.clientX;
            const startY = e.clientY;
            let hasMoved = false;
            dragOffset.current = {
                x: e.clientX / scale - node.x,
                y: e.clientY / scale - node.y
            };
            const onMove = {
                "DraggableNode.useCallback[handleMouseDown].onMove": (ev)=>{
                    if (!isDragging.current) return;
                    const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
                    if (dist > 5) {
                        hasMoved = true;
                    }
                    const newX = ev.clientX / scale - dragOffset.current.x;
                    const newY = ev.clientY / scale - dragOffset.current.y;
                    onDrag(node.id, newX, newY);
                }
            }["DraggableNode.useCallback[handleMouseDown].onMove"];
            const onUp = {
                "DraggableNode.useCallback[handleMouseDown].onUp": ()=>{
                    isDragging.current = false;
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                    if (!hasMoved) {
                        onDoubleClick(node);
                    }
                }
            }["DraggableNode.useCallback[handleMouseDown].onUp"];
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        }
    }["DraggableNode.useCallback[handleMouseDown]"], [
        node,
        scale,
        onDrag,
        onDoubleClick
    ]);
    const handleDoubleClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DraggableNode.useCallback[handleDoubleClick]": (e)=>{
            e.stopPropagation();
            onDoubleClick(node);
        }
    }["DraggableNode.useCallback[handleDoubleClick]"], [
        node,
        onDoubleClick
    ]);
    const Icon = node.module.icon;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-node": true,
        className: "node-draggable",
        style: {
            position: "absolute",
            left: node.x - NODE_RADIUS,
            top: node.y - NODE_RADIUS,
            width: NODE_RADIUS * 2,
            zIndex: 10,
            userSelect: "none"
        },
        onMouseDown: handleMouseDown,
        onDoubleClick: handleDoubleClick,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-col items-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: `node-circle ${isActive ? "node-active" : ""}`,
                            style: {
                                width: NODE_RADIUS * 2,
                                height: NODE_RADIUS * 2,
                                backgroundColor: node.module.color
                            },
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                className: "h-10 w-10 text-white"
                            }, void 0, false, {
                                fileName: "[project]/src/components/DraggableNode.tsx",
                                lineNumber: 108,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableNode.tsx",
                            lineNumber: 100,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute top-1 right-1",
                            onClick: (e)=>{
                                e.stopPropagation();
                                onSettings(node);
                            },
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"], {
                                className: "h-4 w-4 text-white/70 hover:text-white cursor-pointer"
                            }, void 0, false, {
                                fileName: "[project]/src/components/DraggableNode.tsx",
                                lineNumber: 119,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableNode.tsx",
                            lineNumber: 112,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        isFirst && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-card shadow-lg border-2 border-background flex items-center justify-center",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                className: "h-4 w-4 text-yellow-400 fill-yellow-400"
                            }, void 0, false, {
                                fileName: "[project]/src/components/DraggableNode.tsx",
                                lineNumber: 125,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableNode.tsx",
                            lineNumber: 124,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        !isFirst && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute -top-1 -right-1 w-6 h-6 rounded-full bg-card shadow border border-border flex items-center justify-center",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] font-bold text-muted-foreground",
                                children: index
                            }, void 0, false, {
                                fileName: "[project]/src/components/DraggableNode.tsx",
                                lineNumber: 132,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableNode.tsx",
                            lineNumber: 131,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/DraggableNode.tsx",
                    lineNumber: 98,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-2 text-center pointer-events-none",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-xs font-semibold text-foreground whitespace-nowrap",
                            children: node.module.name
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableNode.tsx",
                            lineNumber: 139,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        node.module.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-[10px] text-muted-foreground whitespace-nowrap",
                            children: node.module.description
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableNode.tsx",
                            lineNumber: 143,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/DraggableNode.tsx",
                    lineNumber: 138,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/DraggableNode.tsx",
            lineNumber: 97,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/DraggableNode.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(DraggableNode, "Ot1Iu3/cRAiixPFkG8HxY7gs8mk=");
_c = DraggableNode;
const __TURBOPACK__default__export__ = /*#__PURE__*/ _c1 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].memo(DraggableNode);
var _c, _c1;
__turbopack_context__.k.register(_c, "DraggableNode");
__turbopack_context__.k.register(_c1, "%default%");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
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
"[project]/src/components/DraggableCanvas.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$NodeSettingsModal$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/NodeSettingsModal.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wrench.js [client] (ecmascript) <export default as Wrench>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$DraggableNode$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/DraggableNode.tsx [client] (ecmascript)");
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
const NODE_RADIUS = 48;
const DraggableCanvas = ()=>{
    _s();
    const [nodes, setNodes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])());
    const [settingsNode, setSettingsNode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const openSettings = (node)=>{
        setSettingsNode(node);
    };
    const closeSettings = ()=>{
        setSettingsNode(null);
    };
    const [pickerOpen, setPickerOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [insertIndex, setInsertIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [search, setSearch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [runningNodeId, setRunningNodeId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [animatingLineIndex, setAnimatingLineIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(-1);
    /* Canvas pan & zoom */ const [offset, setOffset] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])({
        x: 0,
        y: 0
    });
    const [scale, setScale] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCanvasScale"])());
    const isPanning = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const panStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])({
        x: 0,
        y: 0
    });
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    /* Sync with store */ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DraggableCanvas.useEffect": ()=>{
            const unsubNodes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["subscribeNodes"])({
                "DraggableCanvas.useEffect.unsubNodes": (n)=>setNodes([
                        ...n
                    ])
            }["DraggableCanvas.useEffect.unsubNodes"]);
            const unsubScale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["subscribeScale"])({
                "DraggableCanvas.useEffect.unsubScale": (s)=>setScale(s)
            }["DraggableCanvas.useEffect.unsubScale"]);
            const unsubRunning = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["subscribeRunningNode"])({
                "DraggableCanvas.useEffect.unsubRunning": (id)=>setRunningNodeId(id)
            }["DraggableCanvas.useEffect.unsubRunning"]);
            const unsubAnimating = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["subscribeAnimatingLine"])({
                "DraggableCanvas.useEffect.unsubAnimating": (idx)=>setAnimatingLineIndex(idx)
            }["DraggableCanvas.useEffect.unsubAnimating"]);
            return ({
                "DraggableCanvas.useEffect": ()=>{
                    unsubNodes();
                    unsubScale();
                    unsubRunning();
                    unsubAnimating();
                }
            })["DraggableCanvas.useEffect"];
        }
    }["DraggableCanvas.useEffect"], []);
    /* ── Pan handlers ──────────────────────────── */ const onCanvasMouseDown = (e)=>{
        if (e.target.closest("[data-node]")) return;
        isPanning.current = true;
        panStart.current = {
            x: e.clientX - offset.x,
            y: e.clientY - offset.y
        };
    };
    const onCanvasMouseMove = (e)=>{
        if (isPanning.current) {
            setOffset({
                x: e.clientX - panStart.current.x,
                y: e.clientY - panStart.current.y
            });
        }
    };
    const onCanvasMouseUp = ()=>{
        isPanning.current = false;
    };
    /* ── Zoom handler ──────────────────────────── */ const onWheel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DraggableCanvas.useCallback[onWheel]": (e)=>{
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setCanvasScale"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCanvasScale"])() + delta);
        }
    }["DraggableCanvas.useCallback[onWheel]"], []);
    /* ── Node drag ─────────────────────────────── */ const onNodeDrag = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DraggableCanvas.useCallback[onNodeDrag]": (id, x, y)=>{
            const updated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])().map({
                "DraggableCanvas.useCallback[onNodeDrag].updated": (n)=>n.id === id ? {
                        ...n,
                        x,
                        y
                    } : n
            }["DraggableCanvas.useCallback[onNodeDrag].updated"]);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])(updated);
        }
    }["DraggableCanvas.useCallback[onNodeDrag]"], []);
    /* ── Node double-click → settings ────────────── */ const onNodeDoubleClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DraggableCanvas.useCallback[onNodeDoubleClick]": (node)=>{
            openSettings(node);
        }
    }["DraggableCanvas.useCallback[onNodeDoubleClick]"], []);
    /* ── Delete node ───────────────────────────── */ const onDeleteNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DraggableCanvas.useCallback[onDeleteNode]": (id)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])().filter({
                "DraggableCanvas.useCallback[onDeleteNode]": (n)=>n.id !== id
            }["DraggableCanvas.useCallback[onDeleteNode]"]));
        }
    }["DraggableCanvas.useCallback[onDeleteNode]"], []);
    /* ── Add node (from picker) ────────────────── */ const openPicker = (index)=>{
        setInsertIndex(index);
        setSearch("");
        setPickerOpen(true);
    };
    const addModule = (mod)=>{
        const current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])();
        // Calculate position: place it near the insertion point
        let x = 200;
        let y = 300;
        if (current.length > 0) {
            if (insertIndex > 0 && insertIndex <= current.length) {
                const prev = current[insertIndex - 1];
                x = prev.x + 220;
                y = prev.y;
            } else if (current.length > 0) {
                const last = current[current.length - 1];
                x = last.x + 220;
                y = last.y;
            }
        }
        const newNode = {
            id: `n-${Date.now()}`,
            module: mod,
            params: {
                ...mod.defaultParams
            },
            x,
            y
        };
        const next = [
            ...current
        ];
        next.splice(insertIndex, 0, newNode);
        // If we inserted in the middle, push subsequent nodes right
        for(let i = insertIndex + 1; i < next.length; i++){
            if (next[i].x <= next[i - 1].x + 100) {
                next[i] = {
                    ...next[i],
                    x: next[i - 1].x + 220
                };
            }
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])(next);
        setPickerOpen(false);
    };
    const filtered = (nodes.length === 0 ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["ALL_MODULES"] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["STEP_MODULES"]).filter((a)=>a.name.toLowerCase().includes(search.toLowerCase()));
    /* ── SVG connections ───────────────────────── */ const renderConnections = ()=>{
        if (nodes.length < 2) return null;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            className: "absolute inset-0 w-full h-full pointer-events-none",
            style: {
                zIndex: 0
            },
            children: nodes.slice(0, -1).map((node, i)=>{
                const next = nodes[i + 1];
                const x1 = node.x + NODE_RADIUS;
                const y1 = node.y;
                const x2 = next.x - NODE_RADIUS;
                const y2 = next.y;
                const isActive = animatingLineIndex === i;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].Fragment, {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                            x1: x1,
                            y1: y1,
                            x2: x2,
                            y2: y2,
                            className: `dotted-connection ${isActive ? "active-path" : ""}`
                        }, void 0, false, {
                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                            lineNumber: 168,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0)),
                        isActive && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                            r: "6",
                            fill: "#14F195",
                            style: {
                                filter: "drop-shadow(0 0 6px #14F195)"
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("animate", {
                                    attributeName: "cx",
                                    from: x1,
                                    to: x2,
                                    dur: "1.2s",
                                    repeatCount: "indefinite"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 177,
                                    columnNumber: 19
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("animate", {
                                    attributeName: "cy",
                                    from: y1,
                                    to: y2,
                                    dur: "1.2s",
                                    repeatCount: "indefinite"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 178,
                                    columnNumber: 19
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                            lineNumber: 176,
                            columnNumber: 17
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, `conn-frag-${node.id}-${next.id}`, true, {
                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                    lineNumber: 167,
                    columnNumber: 13
                }, ("TURBOPACK compile-time value", void 0));
            })
        }, void 0, false, {
            fileName: "[project]/src/components/DraggableCanvas.tsx",
            lineNumber: 155,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    };
    /* ── "+" buttons between nodes ─────────────── */ const renderAddButtons = ()=>{
        const btns = [];
        // Between nodes
        for(let i = 0; i < nodes.length - 1; i++){
            const n1 = nodes[i];
            const n2 = nodes[i + 1];
            const mx = (n1.x + n2.x) / 2;
            const my = (n1.y + n2.y) / 2;
            btns.push(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "add-between-btn",
                style: {
                    position: "absolute",
                    left: mx - 14,
                    top: my - 14,
                    zIndex: 5
                },
                onClick: ()=>openPicker(i + 1),
                title: "Insert step",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                    lineNumber: 210,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, `add-${i}`, false, {
                fileName: "[project]/src/components/DraggableCanvas.tsx",
                lineNumber: 198,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)));
        }
        // After last node
        if (nodes.length > 0) {
            const last = nodes[nodes.length - 1];
            btns.push(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "add-end-btn",
                style: {
                    position: "absolute",
                    left: last.x + NODE_RADIUS + 30,
                    top: last.y - 14,
                    zIndex: 5
                },
                onClick: ()=>openPicker(nodes.length),
                title: "Add step",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                    className: "h-5 w-5"
                }, void 0, false, {
                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                    lineNumber: 230,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, "add-end", false, {
                fileName: "[project]/src/components/DraggableCanvas.tsx",
                lineNumber: 218,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)));
        }
        return btns;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 h-full overflow-hidden relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: containerRef,
                className: "w-full h-full grid-pattern cursor-grab active:cursor-grabbing",
                onMouseDown: onCanvasMouseDown,
                onMouseMove: onCanvasMouseMove,
                onMouseUp: onCanvasMouseUp,
                onMouseLeave: onCanvasMouseUp,
                onWheel: (e)=>e.preventDefault(),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative w-full h-full",
                    style: {
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        transformOrigin: "0 0"
                    },
                    children: [
                        renderConnections(),
                        renderAddButtons(),
                        nodes.map((node, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$DraggableNode$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                                node: node,
                                isFirst: i === 0,
                                index: i,
                                scale: scale,
                                isActive: runningNodeId === node.id,
                                onDrag: onNodeDrag,
                                onDoubleClick: onNodeDoubleClick,
                                onSettings: openSettings
                            }, node.id, false, {
                                fileName: "[project]/src/components/DraggableCanvas.tsx",
                                lineNumber: 260,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))),
                        nodes.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>openPicker(0),
                                    className: "w-28 h-28 rounded-full bg-muted/60 border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-muted transition-all animate-glow",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                        className: "h-10 w-10 text-muted-foreground"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/DraggableCanvas.tsx",
                                        lineNumber: 280,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 276,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-4 text-center text-muted-foreground text-sm",
                                    children: "Click to add your first module"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 282,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                            lineNumber: 275,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                    lineNumber: 249,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/DraggableCanvas.tsx",
                lineNumber: 240,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            settingsNode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$NodeSettingsModal$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                node: settingsNode,
                onSave: (updatedNode)=>{
                    const list = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])().map((n)=>n.id === updatedNode.id ? updatedNode : n);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])(list);
                    closeSettings();
                },
                onDelete: (id)=>{
                    onDeleteNode(id);
                    closeSettings();
                },
                onClose: closeSettings
            }, void 0, false, {
                fileName: "[project]/src/components/DraggableCanvas.tsx",
                lineNumber: 292,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            pickerOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4",
                onClick: ()=>setPickerOpen(false),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex overflow-hidden border border-border/60",
                    onClick: (e)=>e.stopPropagation(),
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-48 bg-muted/30 p-3 border-r border-border/40 flex flex-col gap-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "grid place-items-center w-5 h-5",
                                            children: "▦"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                                            lineNumber: 319,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        "All modules"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 318,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                                            lineNumber: 323,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        " AI modules"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 322,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                                            lineNumber: 326,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        " Triggers"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 325,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__["Wrench"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                                            lineNumber: 329,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        " Actions"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 328,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                            lineNumber: 317,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 flex flex-col",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "p-3 border-b border-border/40",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "relative",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                                className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                lineNumber: 335,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                autoFocus: true,
                                                value: search,
                                                onChange: (e)=>setSearch(e.target.value),
                                                placeholder: "Search modules...",
                                                className: "w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                lineNumber: 336,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/DraggableCanvas.tsx",
                                        lineNumber: 334,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 333,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "overflow-y-auto flex-1 p-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide",
                                            children: nodes.length === 0 ? "All modules" : "Action modules"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                                            lineNumber: 346,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        filtered.map((mod)=>{
                                            const Icon = mod.icon;
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>addModule(mod),
                                                className: "w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-md group-hover:shadow-lg transition-shadow",
                                                        style: {
                                                            backgroundColor: mod.color
                                                        },
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                                            className: "h-5 w-5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                            lineNumber: 361,
                                                            columnNumber: 25
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                        lineNumber: 357,
                                                        columnNumber: 23
                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-sm font-medium",
                                                                children: mod.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                                lineNumber: 364,
                                                                columnNumber: 25
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            mod.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-xs text-muted-foreground",
                                                                children: mod.description
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                                lineNumber: 366,
                                                                columnNumber: 27
                                                            }, ("TURBOPACK compile-time value", void 0))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                        lineNumber: 363,
                                                        columnNumber: 23
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                ]
                                            }, mod.type, true, {
                                                fileName: "[project]/src/components/DraggableCanvas.tsx",
                                                lineNumber: 352,
                                                columnNumber: 21
                                            }, ("TURBOPACK compile-time value", void 0));
                                        })
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                                    lineNumber: 345,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/DraggableCanvas.tsx",
                            lineNumber: 332,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/DraggableCanvas.tsx",
                    lineNumber: 313,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/src/components/DraggableCanvas.tsx",
                lineNumber: 309,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/DraggableCanvas.tsx",
        lineNumber: 238,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(DraggableCanvas, "8dHPd+kQDrg+NvGTVlJWMLwQbLU=");
_c = DraggableCanvas;
const __TURBOPACK__default__export__ = DraggableCanvas;
var _c;
__turbopack_context__.k.register(_c, "DraggableCanvas");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/solana.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@solana/web3.js/lib/index.browser.esm.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bs58$2f$src$2f$esm$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/bs58/src/esm/index.js [client] (ecmascript)");
;
;
const CLUSTER = ("TURBOPACK compile-time value", "devnet") || "devnet";
const SOLANA_CLUSTER = CLUSTER;
const connection = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Connection"]((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["clusterApiUrl"])(CLUSTER), "confirmed");
const MEMO_PROGRAM_ID = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["PublicKey"]("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
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
    const ix = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["TransactionInstruction"]({
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
    const tx = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Transaction"]().add(ix);
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
                    raw = new TextDecoder().decode(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bs58$2f$src$2f$esm$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].decode(ix.data));
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/SettingsDialog.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$dom$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-dom/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/settings.js [client] (ecmascript) <export default as Settings>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/save.js [client] (ecmascript) <export default as Save>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wallet.js [client] (ecmascript) <export default as Wallet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bell.js [client] (ecmascript) <export default as Bell>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [client] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
const SettingsDialog = ()=>{
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [recipient, setRecipient] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [alertChannel, setAlertChannel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])("app");
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SettingsDialog.useEffect": ()=>{
            setMounted(true);
            if (open) {
                const s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSettings"])();
                setRecipient(s.recipientWallet);
                setAlertChannel(s.alertChannel);
            }
        }
    }["SettingsDialog.useEffect"], [
        open
    ]);
    const handleSave = ()=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["saveSettings"])({
            recipientWallet: recipient,
            alertChannel
        });
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success("Settings saved");
        setOpen(false);
    };
    const modalContent = open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm",
        onClick: ()=>setOpen(false),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-card w-full max-w-md rounded-2xl border border-border/60 shadow-2xl animate-in fade-in zoom-in-95 duration-200",
            onClick: (e)=>e.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between p-5 border-b border-border/40",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"], {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setOpen(false),
                            className: "p-1 hover:bg-muted rounded-lg",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-5 space-y-5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bell$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bell$3e$__["Bell"], {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative w-full",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            value: alertChannel,
                                            onChange: (e)=>setAlertChannel(e.target.value),
                                            className: "w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm appearance-none cursor-pointer pr-10",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "app",
                                                    children: "In-App Notification"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 77,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "email",
                                                    children: "Email"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 78,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: "telegram",
                                                    children: "Telegram"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/SettingsDialog.tsx",
                                                    lineNumber: 79,
                                                    columnNumber: 17
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
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
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-5 border-t border-border/40",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: handleSave,
                        className: "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__["Save"], {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>setOpen(true),
                className: "p-2 rounded-full border border-border hover:bg-muted transition-colors",
                title: "Settings",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"], {
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
            mounted ? /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$dom$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].createPortal(modalContent, document.body) : null
        ]
    }, void 0, true);
};
_s(SettingsDialog, "rY7D3ph+5pycoTgHGCDPkgic8Ho=");
_c = SettingsDialog;
const __TURBOPACK__default__export__ = SettingsDialog;
var _c;
__turbopack_context__.k.register(_c, "SettingsDialog");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/utils.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [client] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/dialog.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Dialog",
    ()=>Dialog,
    "DialogClose",
    ()=>DialogClose,
    "DialogContent",
    ()=>DialogContent,
    "DialogDescription",
    ()=>DialogDescription,
    "DialogFooter",
    ()=>DialogFooter,
    "DialogHeader",
    ()=>DialogHeader,
    "DialogOverlay",
    ()=>DialogOverlay,
    "DialogPortal",
    ()=>DialogPortal,
    "DialogTitle",
    ()=>DialogTitle,
    "DialogTrigger",
    ()=>DialogTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-dialog/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [client] (ecmascript)");
;
;
;
;
;
const Dialog = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Root"];
const DialogTrigger = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Trigger"];
const DialogPortal = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Portal"];
const DialogClose = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Close"];
const DialogOverlay = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["forwardRef"](({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Overlay"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["cn"])("fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 19,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c = DialogOverlay;
DialogOverlay.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Overlay"].displayName;
const DialogContent = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["forwardRef"](_c1 = ({ className, children, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogPortal, {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogOverlay, {}, void 0, false, {
                fileName: "[project]/src/components/ui/dialog.tsx",
                lineNumber: 35,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Content"], {
                ref: ref,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["cn"])("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg", className),
                ...props,
                children: [
                    children,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Close"], {
                        className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/dialog.tsx",
                                lineNumber: 46,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/dialog.tsx",
                                lineNumber: 47,
                                columnNumber: 9
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/dialog.tsx",
                        lineNumber: 45,
                        columnNumber: 7
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/dialog.tsx",
                lineNumber: 36,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 34,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c2 = DialogContent;
DialogContent.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Content"].displayName;
const DialogHeader = ({ className, ...props })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col space-y-1.5 text-center sm:text-left", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 58,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c3 = DialogHeader;
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 72,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c4 = DialogFooter;
DialogFooter.displayName = "DialogFooter";
const DialogTitle = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["forwardRef"](_c5 = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Title"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["cn"])("text-lg font-semibold leading-none tracking-tight", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 86,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c6 = DialogTitle;
DialogTitle.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Title"].displayName;
const DialogDescription = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["forwardRef"](_c7 = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Description"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["cn"])("text-sm text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 101,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c8 = DialogDescription;
DialogDescription.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["Description"].displayName;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
__turbopack_context__.k.register(_c, "DialogOverlay");
__turbopack_context__.k.register(_c1, "DialogContent$React.forwardRef");
__turbopack_context__.k.register(_c2, "DialogContent");
__turbopack_context__.k.register(_c3, "DialogHeader");
__turbopack_context__.k.register(_c4, "DialogFooter");
__turbopack_context__.k.register(_c5, "DialogTitle$React.forwardRef");
__turbopack_context__.k.register(_c6, "DialogTitle");
__turbopack_context__.k.register(_c7, "DialogDescription$React.forwardRef");
__turbopack_context__.k.register(_c8, "DialogDescription");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/TransactionSuccessModal.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/dialog.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/external-link.js [client] (ecmascript) <export default as ExternalLink>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/copy.js [client] (ecmascript) <export default as Copy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/terminal.js [client] (ecmascript) <export default as Terminal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
;
;
;
;
const TransactionSuccessModal = ({ isOpen, onClose, txData })=>{
    if (!txData) return null;
    const copyToClipboard = (text)=>{
        navigator.clipboard.writeText(text);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success("Copiado al portapapeles");
    };
    const txSignature = txData.signature || "";
    const explorerUrl = `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["Dialog"], {
        open: isOpen,
        onOpenChange: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DialogContent"], {
            className: "sm:max-w-[460px] border-emerald-500/20 bg-background text-foreground",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                    className: "flex flex-col items-center text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 text-emerald-500 animate-pulse",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                className: "h-9 w-9"
                            }, void 0, false, {
                                fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                lineNumber: 42,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 41,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                            className: "text-xl font-bold tracking-tight text-emerald-400",
                            children: "¡Simulación Exitosa!"
                        }, void 0, false, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 45,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                            className: "text-sm text-muted-foreground mt-1",
                            children: [
                                "El workflow se procesó correctamente en ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "font-semibold text-foreground",
                                    children: "la capa de simulación."
                                }, void 0, false, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 50,
                                    columnNumber: 53
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 49,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                    lineNumber: 40,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3 my-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-muted/50 p-3 rounded-lg border border-border/60 text-xs space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex justify-between items-center",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-muted-foreground font-medium",
                                            children: "Acción simulada:"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                            lineNumber: 58,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                                            children: txData.actionType || "send_transaction"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                            lineNumber: 59,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 57,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                txData.blockhash && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex justify-between items-center",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-muted-foreground font-medium",
                                            children: "Recent Blockhash:"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                            lineNumber: 65,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono text-muted-foreground/90",
                                            children: [
                                                txData.blockhash.slice(0, 8),
                                                "...",
                                                txData.blockhash.slice(-8)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                            lineNumber: 66,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 64,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 56,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1.5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-xs font-semibold text-muted-foreground flex items-center gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"], {
                                            className: "h-3 w-3"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                            lineNumber: 76,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        " Transacción Serializada (Base64)"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 75,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative group bg-black/40 p-3 rounded-lg border border-border font-mono text-[11px] text-zinc-300 break-all max-h-24 overflow-y-auto",
                                    children: [
                                        txData.signature || "Sin datos de payload",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>copyToClipboard(txData.signature || ""),
                                            className: "absolute top-2 right-2 p-1 rounded bg-background border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted",
                                            title: "Copiar Transacción",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__["Copy"], {
                                                className: "h-3 w-3 text-muted-foreground"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                                lineNumber: 86,
                                                columnNumber: 17
                                            }, ("TURBOPACK compile-time value", void 0))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                            lineNumber: 81,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 78,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 74,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                    className: "sm:space-x-3 gap-2 sm:gap-0 mt-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["DialogClose"], {
                            asChild: true,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "flex-1 sm:flex-none px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors border border-border",
                                children: "Cerrar"
                            }, void 0, false, {
                                fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                lineNumber: 95,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 94,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                            href: explorerUrl,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className: "flex items-center justify-center gap-1.5 flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-md shadow-emerald-900/10 text-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Ver transacción"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 106,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                                    className: "h-3.5 w-3.5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                                    lineNumber: 107,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                            lineNumber: 100,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/TransactionSuccessModal.tsx",
                    lineNumber: 93,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/TransactionSuccessModal.tsx",
            lineNumber: 37,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/TransactionSuccessModal.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = TransactionSuccessModal;
const __TURBOPACK__default__export__ = TransactionSuccessModal;
var _c;
__turbopack_context__.k.register(_c, "TransactionSuccessModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/price.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getPrice",
    ()=>getPrice
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
const getPrice = async (asset)=>{
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    // Convertimos el string "SOL" al Mint correspondiente para la consulta
    const address = asset === "SOL" ? SOL_MINT : asset;
    // Intentamos leer la API Key desde las variables de entorno de Vite (.env)
    const JUP_API_KEY = ("TURBOPACK compile-time value", "jup_ef6c05a6714e6e25e4f8ed5652e42457f3c358a7d7378558a61a1a2a1588eae5") || "";
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
    } catch (error) {
        console.error(`[PRICE FETCH ERROR] Failed to fetch price from Jupiter V3 for ${asset}:`, error.message);
        // MOCK DE RESPALDO (FALLBACK) para que el simulador 'Run Once' no explote si no hay internet o API Key
        if (asset === "SOL" || address === SOL_MINT) {
            return 140.00;
        }
        return 1.00; // Valor por defecto si es una stablecoin o token desconocido
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/triggerEngine.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TriggerEngine",
    ()=>TriggerEngine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$price$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/price.ts [client] (ecmascript)");
;
class TriggerEngine {
    /**
   * Main entry point to validate any trigger node.
   */ async validateTrigger(node) {
        const { params } = node;
        console.log(`Evaluating trigger: ${node.module.type}`, params);
        switch(node.module.type){
            case "price_monitor":
                return await this.evaluatePriceMonitor(params);
            case "schedule":
                return await this.evaluateSchedule(params);
            case "webhook":
                return await this.evaluateWebhook(params);
            default:
                console.warn(`Unknown trigger type: ${node.module.type}`);
                return false;
        }
    }
    async evaluatePriceMonitor(params) {
        // console.log("Evaluating Price Monitor with params:", JSON.stringify(params, null, 2));
        const { asset, condition, value } = params;
        if (!asset || typeof asset !== 'string') {
            console.error("Trigger failed: 'asset' is missing or invalid", asset);
            return false;
        }
        if (!asset || value === undefined || !condition) {
            console.error("Price Monitor configuration is missing required fields:", params);
            return false;
        }
        const currentPrice = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$price$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getPrice"])(asset);
        console.log(`Current ${asset} price: ${currentPrice}. Target: ${value}`);
        switch(condition){
            case "above":
                return currentPrice > value;
            case "below":
                return currentPrice < value;
            case "change_pct":
                // Implementation for percentage change logic
                return false;
            default:
                return false;
        }
    }
    async evaluateSchedule(params) {
        // Logic for time-based triggers (e.g., cron verification)
        console.log("Evaluating schedule trigger:", params.every);
        return true;
    }
    async evaluateWebhook(params) {
        // Logic for HTTP endpoint triggers
        console.log("Waiting for webhook on path:", params.path);
        return false; // Webhooks usually wait for external signal
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/BottomToolbar.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/save.js [client] (ecmascript) <export default as Save>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zoom$2d$in$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ZoomIn$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zoom-in.js [client] (ecmascript) <export default as ZoomIn>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zoom$2d$out$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ZoomOut$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zoom-out.js [client] (ecmascript) <export default as ZoomOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock.js [client] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/upload.js [client] (ecmascript) <export default as Upload>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2f$lib$2f$esm$2f$useWallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@solana/wallet-adapter-react/lib/esm/useWallet.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$buffer$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/buffer/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@solana/web3.js/lib/index.browser.esm.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/solana.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflow.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/workflowStore.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/integrations/supabase/client.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$SettingsDialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/SettingsDialog.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$TransactionSuccessModal$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/TransactionSuccessModal.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$triggerEngine$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/triggerEngine.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/router.js [client] (ecmascript)");
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
;
;
;
;
;
const BottomToolbar = ()=>{
    _s();
    const [publishing, setPublishing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isRunning, setIsRunning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [scale, setScale] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCanvasScale"])());
    const [isModalOpen, setIsModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [lastTxData, setLastTxData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { publicKey, connected, sendTransaction } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2f$lib$2f$esm$2f$useWallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useWallet"])();
    const [editingId, setEditingId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [walletAddress, setWalletAddress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BottomToolbar.useEffect": ()=>{
            const unsub = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["subscribeScale"])({
                "BottomToolbar.useEffect.unsub": (s)=>setScale(s)
            }["BottomToolbar.useEffect.unsub"]);
            return ({
                "BottomToolbar.useEffect": ()=>{
                    unsub();
                }
            })["BottomToolbar.useEffect"];
        }
    }["BottomToolbar.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BottomToolbar.useEffect": ()=>{
            if (publicKey) {
                setWalletAddress(publicKey.toBase58());
            } else {
                setWalletAddress(null);
            }
        }
    }["BottomToolbar.useEffect"], [
        publicKey
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BottomToolbar.useEffect": ()=>{
            if (!router.isReady || !walletAddress || !router.query.id) {
                return;
            }
            const { id } = router.query;
            const saved = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSavedWorkflows"])(walletAddress);
            const found = saved.find({
                "BottomToolbar.useEffect.found": (w)=>w.id === id || w.pinataId === id
            }["BottomToolbar.useEffect.found"]);
            if (found) {
                setEditingId(found.pinataId || found.id);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setScenarioName"])(found.name);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setFlowNodes"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["workflowToNodes"])(found.workflow));
            } else {
                console.warn("Workflow not found for the provided ID");
            }
        }
    }["BottomToolbar.useEffect"], [
        router.isReady,
        router.query.id,
        walletAddress
    ]);
    const handleSave = async ()=>{
        if (!connected || !publicKey) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error("Wallet required", {
                description: "Please connect your wallet."
            });
            return;
        }
        const wf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getWorkflow"])();
        if (!wf) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error("Build or generate a workflow first");
            return;
        }
        const walletAddress = publicKey.toBase58();
        const currentWorkflow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflow$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["nodesToWorkflow"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getScenarioName"])(), (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])());
        if (currentWorkflow) {
            wf.trigger = currentWorkflow.trigger;
            wf.steps = currentWorkflow.steps;
            wf.name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getScenarioName"])();
        }
        const saved = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSavedWorkflows"])(walletAddress);
        // FIX: Buscamos usando las propiedades reales del registro de almacenamiento
        const existing = saved.find((s)=>s.id === editingId || s.pinata_file_id === editingId);
        // CRITICAL FIX: Pinata necesita el "pinata_file_id" real de la nube para poder actualizar el JSON
        const cloudTargetId = existing?.pinata_file_id || existing?.id || editingId;
        const oldCid = existing?.cid;
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].promise(async ()=>{
            if (editingId) {
                // Sincronizado exactamente con: (id, name, updatedData, walletAddress)
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["updateWorkflow"])(editingId, wf.name, wf, walletAddress);
                return result;
            } else {
                const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["saveWorkflow"])(wf.name, wf, walletAddress, "skip", editingId);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["saveLocalOnly"])(wf.name, wf, walletAddress);
                if (result.id) setEditingId(result.id);
                return result;
            }
        }, {
            loading: editingId ? "Syncing updates with IPFS network..." : "Uploading workflow to IPFS...",
            success: ()=>editingId ? "Workflow updated successfully" : "Workflow saved to cloud",
            error: (e)=>{
                console.error("Cloud operational sync failed:", e);
                try {
                    if (editingId) {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["updateWorkflow"])(editingId, wf.name, wf, walletAddress);
                    } else {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["saveLocalOnly"])(wf.name, wf, walletAddress);
                    }
                    return "Saved locally (Cloud sync failed)";
                } catch (localError) {
                    return "Critical save failure: storage unavailable";
                }
            }
        });
    };
    const runSimulation = async ()=>{
        const nodes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getFlowNodes"])();
        if (nodes.length === 0) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error("Add at least one node to simulate the workflow");
            return;
        }
        setIsRunning(true);
        const triggerEngine = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$triggerEngine$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["TriggerEngine"]();
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info("Starting workflow simulation...");
        let simulatedTxSnapshot = null;
        try {
            setLastTxData(null);
            for(let i = 0; i < nodes.length; i++){
                const node = nodes[i];
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setRunningNodeId"])(node.id);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setAnimatingLineIndex"])(-1);
                console.log(`Procesando nodo ${i}: ${node.module.name} (Kind: ${node.module.kind})`);
                const params = node.params || {};
                if (node.module.kind === "trigger") {
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info(`Validating trigger: ${node.module.name}...`);
                    const isTriggered = await triggerEngine.validateTrigger(node);
                    console.log(`Resultado de la validación del trigger: ${isTriggered}`);
                    if (!isTriggered) {
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error(`Condition not met: ${node.module.name}`);
                        return;
                    }
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success("Trigger condition met!");
                } else {
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info(`Executing step ${i}: ${node.module.name}...`);
                    await new Promise((r)=>setTimeout(r, 1000));
                    let desc = "Action executed successfully.";
                    try {
                        if (node.module.type === "send_transaction") {
                            console.log("Nodo analizado:", node);
                            console.log("Params del nodo:", node.params);
                            const targetAmount = params.amount || "1";
                            const targetAsset = params.asset || "USDC";
                            const targetTo = params.to || "11111111111111111111111111111111";
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info(`Preparing transfer of ${node.params.amount} ${node.params.asset}...`, {
                                description: "Please sign the transaction in your wallet"
                            });
                            console.log("Nodo enviado a simular:", JSON.stringify(node, null, 2));
                            const payload = {
                                actionType: "send_transaction",
                                owner: publicKey?.toBase58(),
                                params: {
                                    to: node.params.to,
                                    amount: parseFloat(node.params.amount),
                                    asset: node.params.asset
                                }
                            };
                            console.log("Payload enviado al servidor:", JSON.stringify(payload, null, 2));
                            const response = await fetch("/api/workflow/simulate-tx", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    actionType: "send_transaction",
                                    owner: publicKey?.toBase58(),
                                    params: {
                                        to: node.params.to,
                                        amount: parseFloat(node.params.amount),
                                        asset: node.params.asset
                                    }
                                })
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.error || "Failed to simulate transaction");
                            const transaction = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Transaction"].from(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$buffer$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Buffer"].from(data.serializedTx, "base64"));
                            // Manejo de la firma con captura de cancelación
                            const signature = await sendTransaction(transaction, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["connection"]).catch((err)=>{
                                if (err.name === 'WalletSendTransactionError' || err.message?.includes('User rejected')) {
                                    throw new Error("Canceled By User");
                                }
                                throw err;
                            });
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].info("Transaction broadcasted! Waiting for confirmation...");
                            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["connection"].confirmTransaction(signature, "confirmed");
                            desc = `Successfully sent ${node.params.amount} ${node.params.asset} to ${node.params.to.slice(0, 6)}...`;
                            simulatedTxSnapshot = {
                                signature,
                                actionType: "send_transaction"
                            };
                            setLastTxData(simulatedTxSnapshot);
                        } else if (node.module.type === "send_alert") {
                            desc = `Alert "${node.params.message || 'Trigger fired!'}" sent via ${node.params.channel || 'app'}`;
                        } else if (node.module.type === "swap") {
                            desc = `Swapped ${node.params.amount || 1} ${node.params.from || 'SOL'} for ${node.params.to || 'USDC'} via Jupiter`;
                        }
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success(`Step ${i} completed: ${node.module.name}`, {
                            description: desc
                        });
                    } catch (err) {
                        // Si el usuario canceló, relanzamos el error especial para manejarlo en el try/catch principal
                        if (err.message === "Canceled By User") {
                            throw err;
                        }
                        // Si es un error de ejecución, lo notificamos
                        console.error("Step execution error:", err);
                        throw new Error(`Step ${i} failed: ${err.message}`);
                    }
                }
                // Animación de conexión
                if (i < nodes.length - 1) {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setRunningNodeId"])(null);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setAnimatingLineIndex"])(i);
                    await new Promise((r)=>setTimeout(r, 1200));
                }
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setRunningNodeId"])(null);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setAnimatingLineIndex"])(-1);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success("Workflow simulation completed successfully! 🎉");
            if (simulatedTxSnapshot) setIsModalOpen(true);
        } catch (err) {
            console.error(err);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error(err.message || "Simulation failed");
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setRunningNodeId"])(null);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setAnimatingLineIndex"])(-1);
        } finally{
            setIsRunning(false);
        }
    };
    // const runSimulation = async () => {
    //   const nodes = getFlowNodes();
    //   if (nodes.length === 0) {
    //     toast.error("Add at least one node to simulate the workflow");
    //     return;
    //   }
    //   setIsRunning(true);
    //   const triggerEngine = new TriggerEngine();
    //   toast.info("Starting workflow simulation...");
    //   let simulatedTxSnapshot = null;
    //   try {
    //     setLastTxData(null);
    //     for (let i = 0; i < nodes.length; i++) {
    //       const node = nodes[i] as FlowNode;
    //       setRunningNodeId(node.id);
    //       setAnimatingLineIndex(-1);
    //       console.log(`Procesando nodo ${i}: ${node.module?.name} (Kind: ${node.module?.kind})`);
    //       const params = node.params || {};
    //       if (node.module?.kind === "trigger") {
    //         toast.info(`Validating trigger: ${node.module.name}...`);
    //         const isTriggered = await triggerEngine.validateTrigger(node);
    //         console.log(`Resultado de la validación del trigger: ${isTriggered}`);
    //         if (!isTriggered) {
    //           toast.error(`Condition not met: ${node.module.name}`);
    //           return;
    //         }
    //         toast.success("Trigger condition met!");
    //       } else {
    //         toast.info(`Executing step ${i}: ${node.module?.name}...`);
    //         await new Promise((r) => setTimeout(r, 1000));
    //         let desc = "Action executed successfully.";
    //         console.log("PARAMS ", params.amount, params.asset, params.to);
    //         try {
    //           if (node.module?.type === "send_transaction") {
    //             const targetAmount = params.amount || "0.1";
    //             const targetAsset = params.asset || "SOL";
    //             const targetTo = params.to || "11111111111111111111111111111111";
    //             toast.info(`Preparing transfer of ${targetAmount} ${targetAsset}...`, {
    //               description: "Please sign the transaction in your wallet"
    //             });
    //             const response = await fetch("/api/workflow/simulate-tx", {
    //               method: "POST",
    //               headers: { "Content-Type": "application/json" },
    //               body: JSON.stringify({
    //                 actionType: "send_transaction", 
    //                 owner: publicKey?.toBase58(),
    //                 params: {
    //                   to: targetTo,          
    //                   amount: parseFloat(targetAmount),
    //                   asset: targetAsset,
    //                 },
    //               }),
    //             });
    //             const data = await response.json();
    //             if (!response.ok) throw new Error(data.error || "Failed to simulate transaction");
    //             const transaction = Transaction.from(Buffer.from(data.serializedTx, "base64"));
    //             // Manejo de la firma con captura de cancelación
    //             const signature = await sendTransaction(transaction, connection).catch((err) => {
    //               if (err.name === 'WalletSendTransactionError' || err.message?.includes('User rejected')) {
    //                 throw new Error("Canceled By User");
    //               }
    //               throw err;
    //             });
    //             toast.info("Transaction broadcasted! Waiting for confirmation...");
    //             await connection.confirmTransaction(signature, "confirmed");
    //             desc = `Successfully sent ${targetAmount} ${targetAsset} to ${targetTo.slice(0, 6)}...`;
    //             simulatedTxSnapshot = { signature, actionType: "send_transaction" };
    //             setLastTxData(simulatedTxSnapshot);
    //           } else if (node.module?.type === "send_alert") {
    //             desc = `Alert "${params.message || 'Trigger fired!'}" sent via ${params.channel || 'app'}`;
    //           } else if (node.module?.type === "swap") {
    //             desc = `Swapped ${params.amount || 1} ${params.from || 'SOL'} for ${params.to || 'USDC'} via Jupiter`;
    //           }
    //           toast.success(`Step ${i} completed: ${node.module?.name}`, { description: desc });
    //         } catch (err: any) {
    //           if (err.message === "Canceled By User") {
    //             throw err; 
    //           }
    //           console.error("Step execution error:", err);
    //           throw new Error(`Step ${i} failed: ${err.message}`);
    //         }
    //       }
    //       // Animación de conexión
    //       if (i < nodes.length - 1) {
    //         setRunningNodeId(null);
    //         setAnimatingLineIndex(i);
    //         await new Promise((r) => setTimeout(r, 1200));
    //       }
    //     }
    //     setRunningNodeId(null);
    //     setAnimatingLineIndex(-1);
    //     toast.success("Workflow simulation completed successfully! 🎉");
    //     if (simulatedTxSnapshot) setIsModalOpen(true);
    //   } catch (err: any) {
    //     console.error(err);
    //     toast.error(err.message || "Simulation failed");
    //     setRunningNodeId(null);
    //     setAnimatingLineIndex(-1);
    //   } finally {
    //     setIsRunning(false);
    //   }
    // };
    const publishOnchain = async ()=>{
        const wf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getWorkflow"])();
        if (!wf) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error("Build or generate a workflow first");
            return;
        }
        if (!connected || !publicKey) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error("Wallet not connected", {
                description: "Please connect any Solana wallet using the top button."
            });
            return;
        }
        setPublishing(true);
        try {
            // 1. Pin to IPFS
            const { data: pin, error: pinErr } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["supabase"].functions.invoke("pin-to-ipfs", {
                body: {
                    json: wf,
                    name: wf.name
                }
            });
            if (pinErr) throw pinErr;
            if (pin?.error) throw new Error(typeof pin.error === "string" ? pin.error : JSON.stringify(pin.error));
            const cid = pin.cid;
            // 2. Sign + send memo on Solana
            const prev = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getOnchainMeta"])();
            const version = (prev.version ?? 0) + 1;
            // Creamos la instancia de conexión dinámica apuntando a Devnet
            const connection = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$web3$2e$js$2f$lib$2f$index$2e$browser$2e$esm$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Connection"]("https://api.devnet.solana.com", "confirmed");
            // Inyectamos las herramientas requeridas al helper
            const { signature } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["publishWorkflowMemo"])({
                sendTransaction,
                publicKey
            }, {
                name: wf.name,
                cid,
                version
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setOnchainMeta"])({
                cid,
                signature,
                version
            });
            // 3. Persist link in Cloud
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$integrations$2f$supabase$2f$client$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from("workflows").upsert({
                name: wf.name,
                json: wf,
                cid: cid,
                onchain_signature: signature,
                owner_wallet: publicKey.toBase58(),
                device_id: localStorage.getItem("solflows_device_id") || "anon"
            }, {
                onConflict: "name"
            }).then(()=>{}, ()=>{});
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success("Published on-chain", {
                description: `cid ${cid.slice(0, 8)}… · v${version}`,
                action: {
                    label: "View",
                    onClick: ()=>window.open((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$solana$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["solscanUrl"])(signature), "_blank")
                }
            });
        } catch (e) {
            console.error(e);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error(e?.message || "Publish failed");
        } finally{
            setPublishing(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed bottom-0 left-0 right-0 h-12 bg-background border-t border-border flex items-center justify-between px-4 z-30",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleSave,
                                className: "p-2 hover:bg-muted rounded-md flex items-center gap-1 text-sm text-foreground transition-colors",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__["Save"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 488,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Save"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 489,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 484,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: runSimulation,
                                disabled: isRunning,
                                className: "p-2 hover:bg-muted rounded-md flex items-center gap-1 text-sm text-foreground transition-colors disabled:opacity-50",
                                children: [
                                    isRunning ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                        className: "h-4 w-4 animate-spin text-primary"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 497,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                        className: "h-4 w-4 text-emerald-400 fill-emerald-400/20"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 499,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: isRunning ? "Running..." : "Run once"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 501,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 491,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: publishOnchain,
                                disabled: publishing,
                                className: "px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm bg-gradient-purple-cyan text-white hover:opacity-90 disabled:opacity-60 font-medium transition-all",
                                title: "Pin JSON to IPFS and record CID on Solana",
                                children: [
                                    publishing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                        className: "h-4 w-4 animate-spin"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 509,
                                        columnNumber: 27
                                    }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__["Upload"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 509,
                                        columnNumber: 74
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: "Publish on-chain"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/BottomToolbar.tsx",
                                        lineNumber: 510,
                                        columnNumber: 13
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 503,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$SettingsDialog$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 513,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/BottomToolbar.tsx",
                        lineNumber: 483,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 bg-muted/50 rounded-full",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/BottomToolbar.tsx",
                                    lineNumber: 518,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    className: "bg-transparent border-none focus:outline-none text-sm",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            children: "Every 15 minutes"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/BottomToolbar.tsx",
                                            lineNumber: 520,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            children: "Every hour"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/BottomToolbar.tsx",
                                            lineNumber: 521,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            children: "Every day"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/BottomToolbar.tsx",
                                            lineNumber: 522,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            children: "Manual only"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/BottomToolbar.tsx",
                                            lineNumber: 523,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/BottomToolbar.tsx",
                                    lineNumber: 519,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/BottomToolbar.tsx",
                            lineNumber: 517,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/BottomToolbar.tsx",
                        lineNumber: 516,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setCanvasScale"])(scale - 0.1),
                                className: "p-1 hover:bg-muted rounded-md text-foreground transition-colors",
                                title: "Zoom Out",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zoom$2d$out$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ZoomOut$3e$__["ZoomOut"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/BottomToolbar.tsx",
                                    lineNumber: 534,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 529,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs w-10 text-center font-mono",
                                children: [
                                    Math.round(scale * 100),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 536,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$workflowStore$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setCanvasScale"])(scale + 0.1),
                                className: "p-1 hover:bg-muted rounded-md text-foreground transition-colors",
                                title: "Zoom In",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zoom$2d$in$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ZoomIn$3e$__["ZoomIn"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/BottomToolbar.tsx",
                                    lineNumber: 542,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/src/components/BottomToolbar.tsx",
                                lineNumber: 537,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/BottomToolbar.tsx",
                        lineNumber: 528,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/BottomToolbar.tsx",
                lineNumber: 482,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$TransactionSuccessModal$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                isOpen: isModalOpen,
                onClose: setIsModalOpen,
                txData: lastTxData
            }, void 0, false, {
                fileName: "[project]/src/components/BottomToolbar.tsx",
                lineNumber: 546,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true);
};
_s(BottomToolbar, "A3uGJa0PQsfu+Ortu+Hy3n9L4fI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$solana$2f$wallet$2d$adapter$2d$react$2f$lib$2f$esm$2f$useWallet$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useWallet"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = BottomToolbar;
const __TURBOPACK__default__export__ = BottomToolbar;
var _c;
__turbopack_context__.k.register(_c, "BottomToolbar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ThemeToggle.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sun.js [client] (ecmascript) <export default as Sun>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/moon.js [client] (ecmascript) <export default as Moon>");
;
var _s = __turbopack_context__.k.signature();
;
;
const ThemeToggle = ()=>{
    _s();
    const [isDarkMode, setIsDarkMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeToggle.useEffect": ()=>{
            // Check for saved theme preference or use default dark mode
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                setIsDarkMode(false);
                document.documentElement.classList.remove('dark');
            } else {
                setIsDarkMode(true);
                document.documentElement.classList.add('dark');
            }
        }
    }["ThemeToggle.useEffect"], []);
    const toggleTheme = ()=>{
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
        setIsDarkMode(!isDarkMode);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: toggleTheme,
        className: "fixed bottom-20 right-8 p-3 rounded-full bg-muted hover:bg-muted/80 transition-all duration-300 shadow-lg hover:shadow-xl",
        "aria-label": isDarkMode ? "Switch to light mode" : "Switch to dark mode",
        children: isDarkMode ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__["Sun"], {
            className: "h-5 w-5 text-yellow-400"
        }, void 0, false, {
            fileName: "[project]/src/components/ThemeToggle.tsx",
            lineNumber: 38,
            columnNumber: 9
        }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
            className: "h-5 w-5 text-purple-500"
        }, void 0, false, {
            fileName: "[project]/src/components/ThemeToggle.tsx",
            lineNumber: 40,
            columnNumber: 9
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/ThemeToggle.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(ThemeToggle, "wcg0iE8CdipV533flP6RCfuqOPI=");
_c = ThemeToggle;
const __TURBOPACK__default__export__ = ThemeToggle;
var _c;
__turbopack_context__.k.register(_c, "ThemeToggle");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/Layout.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Sidebar$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Sidebar.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$DraggableCanvas$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/DraggableCanvas.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$BottomToolbar$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/BottomToolbar.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ThemeToggle$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ThemeToggle.tsx [client] (ecmascript)");
;
;
;
;
;
// Dashboard
const Layout = ()=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex h-screen",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Sidebar$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/src/components/Layout.tsx",
                lineNumber: 12,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col flex-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-1 overflow-hidden",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$DraggableCanvas$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                            fileName: "[project]/src/components/Layout.tsx",
                            lineNumber: 15,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/src/components/Layout.tsx",
                        lineNumber: 14,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$BottomToolbar$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                        fileName: "[project]/src/components/Layout.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/Layout.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ThemeToggle$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/src/components/Layout.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/Layout.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = Layout;
const __TURBOPACK__default__export__ = Layout;
var _c;
__turbopack_context__.k.register(_c, "Layout");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/pages/dashboard.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Layout$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Layout.tsx [client] (ecmascript)");
;
;
const Index = ()=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Layout$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
        fileName: "[project]/src/pages/dashboard.tsx",
        lineNumber: 5,
        columnNumber: 10
    }, ("TURBOPACK compile-time value", void 0));
};
_c = Index;
const __TURBOPACK__default__export__ = Index;
var _c;
__turbopack_context__.k.register(_c, "Index");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/dashboard.tsx [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/dashboard";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/src/pages/dashboard.tsx [client] (ecmascript)");
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
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/src/pages/dashboard\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/dashboard.tsx [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__0qlsn2r._.js.map