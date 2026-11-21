import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Info,
  Landmark,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  fetchVaultSnapshot,
  initializeVaultPolicy,
  updateVaultPolicy,
  depositVaultSol,
  withdrawVaultSol,
  depositVaultSpl,
  withdrawVaultSpl,
  setVaultPaused,
  fetchVaultActivity,
  lamportsToSol,
  VAULT_PROGRAM_ID,
  type VaultActivity,
  type VaultPolicy,
  type VaultSnapshot,
  type VaultWallet,
} from "@/lib/vault";
import {
  getExecutionMode,
  getOnchainMeta,
  getSettings,
  getWorkflowId,
  subscribeExecutionMode,
  subscribeOnchainMeta,
} from "@/lib/workflowStore";
import { executionModeLabel } from "@/lib/schedule";
import { explorerAddrUrl, shortAddr, solexplorerUrl, solscanUrl } from "@/lib/solana";
import { useCluster } from "@/lib/network";
import { toast } from "sonner";
import { notifyTxSuccess } from "@/lib/tx-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  assetToBaseUnits,
  baseUnitsToAmount,
  findVaultAssetByMint,
  isAssetSupportedOnCluster,
  normalizeVaultAsset,
  supportedAssetLabel,
  VAULT_ASSET_LIST,
  VAULT_ASSETS,
  type VaultAssetSymbol,
} from "@/lib/vaultTokens";

function formatTimestamp(seconds: bigint): string {
  if (!seconds || Number(seconds) <= 0) return "Nunca";
  return new Date(Number(seconds) * 1000).toLocaleString();
}

function formatExpiry(seconds: bigint): string {
  if (!seconds || Number(seconds) <= 0) return "Sin vencimiento";
  return new Date(Number(seconds) * 1000).toLocaleString();
}

function formatInterval(seconds: bigint): string {
  const value = Number(seconds);
  if (!value) return "Sin espera mínima";
  if (value % 3600 === 0) return `${value / 3600} h`;
  if (value % 60 === 0) return `${value / 60} min`;
  return `${value} s`;
}

function toDatetimeLocal(seconds: bigint): string {
  const date = new Date(Number(seconds) * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fieldClass(extra = "") {
  return `min-h-11 w-full rounded-xl border border-border/50 bg-background/70 px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm ${extra}`;
}

const VaultPanel: React.FC<{ hideTrigger?: boolean }> = ({ hideTrigger = false }) => {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [workflowId, setWorkflowId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const [destination, setDestination] = useState("");
  const [maxPerRun, setMaxPerRun] = useState("0.01");
  const [maxTotal, setMaxTotal] = useState("0.1");
  const [intervalMinutes, setIntervalMinutes] = useState("15");
  const [expiry, setExpiry] = useState("");
  const [keeper, setKeeper] = useState("");
  const [keeperPubkey, setKeeperPubkey] = useState<string | null>(null);
  const [keeperError, setKeeperError] = useState<string | null>(null);
  const [executionEnabled, setExecutionEnabled] = useState<boolean | null>(null);
  const [activity, setActivity] = useState<VaultActivity[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [depositAmount, setDepositAmount] = useState("0.005");
  const [selectedAsset, setSelectedAsset] = useState<VaultAssetSymbol>("SOL");
  const [executionMode, setExecutionMode] = useState(getExecutionMode);
  const [hasPublishedReference, setHasPublishedReference] = useState(
    () => Boolean(getOnchainMeta().signature),
  );

  const policy: VaultPolicy | null = snapshot?.policyData || null;
  const cluster = useCluster();
  const isDevnet = cluster !== "mainnet-beta";
  const asset = VAULT_ASSETS[selectedAsset];
  const assetSupported = isAssetSupportedOnCluster(selectedAsset, cluster);
  const policyAsset = policy ? findVaultAssetByMint(policy.assetMint) : null;
  const policyHasUnknownMint = Boolean(
    policy && policy.assetMint !== PublicKey.default.toBase58() && !policyAsset,
  );
  const policyAssetSupported =
    !policyAsset || isAssetSupportedOnCluster(policyAsset.symbol, cluster);
  const displayAsset = policyAsset || asset;

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSnapshot(null);
      return;
    }
    const id = getWorkflowId();
    setWorkflowId(id);
    setBusy("refresh");
    setError(null);
    try {
      const next = await fetchVaultSnapshot(publicKey, id);
      setSnapshot(next);
      try {
        setActivity(await fetchVaultActivity(next.vault));
      } catch {
        setActivity([]);
      }
      if (next.policyData) {
        const current = next.policyData;
        const policyAsset = findVaultAssetByMint(current.assetMint);
        if (policyAsset) {
          setSelectedAsset(policyAsset.symbol);
          setDepositAmount(policyAsset.symbol === "SOL" ? "0.005" : "1");
          setMaxPerRun(baseUnitsToAmount(policyAsset.symbol, current.maxPerRun));
          setMaxTotal(baseUnitsToAmount(policyAsset.symbol, current.maxTotal));
        }
        setDestination(current.destination);
        setIntervalMinutes(String(Number(current.minIntervalSeconds) / 60));
        setExpiry(
          Number(current.expiresAt) > 0 ? toDatetimeLocal(current.expiresAt) : "",
        );
      } else {
        const settings = getSettings();
        setDestination((prev) => prev || settings.recipientWallet || publicKey.toBase58());
      }
      window.dispatchEvent(new Event("vault-updated"));
    } catch (e) {
      setSnapshot(null);
      setError(e instanceof Error ? e.message : "No se pudo leer la bóveda");
    } finally {
      setBusy(null);
    }
  }, [publicKey]);

  useEffect(() => {
    const unsubscribe = subscribeExecutionMode(setExecutionMode);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeOnchainMeta((meta) => {
      setHasPublishedReference(Boolean(meta?.signature));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    let cancelled = false;
    const loadKeeper = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("vault-config");
        if (error) throw error;
        if (!data?.keeper) throw new Error("La aplicación no devolvió un ejecutor");
        if (cancelled) return;
        setKeeperPubkey(String(data.keeper));
        setExecutionEnabled(data.executionEnabled === true);
        setKeeperError(null);
      } catch (e) {
        if (cancelled) return;
        setKeeperPubkey(null);
        setExecutionEnabled(null);
        setKeeperError(
          e instanceof Error ? e.message : "No se pudo cargar el ejecutor",
        );
      }
    };
    void loadKeeper();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const openVault = () => setOpen(true);
    window.addEventListener("open-vault", openVault);
    return () => window.removeEventListener("open-vault", openVault);
  }, []);

  const requireWallet = (): VaultWallet => {
    if (!publicKey) throw new Error("Conecta tu wallet para firmar");
    return wallet as unknown as VaultWallet;
  };

  const parseForm = () => {
    if (!destination.trim()) throw new Error("Indica el destino autorizado");
    if (!Number.isFinite(Number(intervalMinutes)) || Number(intervalMinutes) < 0) {
      throw new Error("El intervalo debe ser 0 o mayor");
    }
    let destinationKey: PublicKey;
    try {
      destinationKey = new PublicKey(destination.trim());
    } catch {
      throw new Error("El destino no es una dirección Solana válida");
    }
    if (snapshot) {
      if (destinationKey.equals(snapshot.vault)) {
        throw new Error("El destino no puede ser la propia bóveda");
      }
      if (destinationKey.equals(snapshot.policy)) {
        throw new Error("El destino no puede ser la cuenta de política");
      }
    }

    let keeperKey: PublicKey;
    const keeperValue = keeper.trim() || keeperPubkey;
    if (!keeperValue) {
      throw new Error(
        keeperError || "No se pudo cargar el ejecutor automático. Intenta de nuevo.",
      );
    }
    try {
      keeperKey = new PublicKey(keeperValue);
    } catch {
      throw new Error("El ejecutor no es una dirección Solana válida");
    }

    if (!assetSupported) {
      throw new Error(`${selectedAsset} no está disponible en la red seleccionada`);
    }
    const maxPerRunBaseUnits = assetToBaseUnits(selectedAsset, maxPerRun);
    const maxTotalBaseUnits = assetToBaseUnits(selectedAsset, maxTotal);
    if (maxPerRunBaseUnits <= 0) throw new Error("El máximo por ejecución debe ser mayor que cero");
    if (maxTotalBaseUnits < maxPerRunBaseUnits) {
      throw new Error("El máximo total no puede ser menor que el máximo por ejecución");
    }
    if (policy && policyAsset?.symbol === selectedAsset && BigInt(maxTotalBaseUnits) < policy.totalSpent) {
      throw new Error("El nuevo máximo total no puede ser menor que lo ya gastado");
    }
    const expiresAt = expiry
      ? Math.floor(new Date(expiry).getTime() / 1000)
      : 0;
    if (expiry && (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000))) {
      throw new Error("La fecha de vencimiento debe estar en el futuro");
    }
    if (!authorized) {
      throw new Error("Debes autorizar explícitamente los límites de la bóveda");
    }
    return {
      destination: destinationKey.toBase58(),
      maxPerRunBaseUnits,
      maxTotalBaseUnits,
      assetMint: asset.mint,
      minIntervalSeconds: Math.round(Number(intervalMinutes) * 60),
      expiresAt,
      keeper: keeperKey.toBase58(),
    };
  };

  const handleSubmit = async () => {
    if (!publicKey) {
      setError("Conecta tu wallet para firmar");
      return;
    }
    setError(null);
    if (!policy && !hasPublishedReference) {
      const message =
        "Publica el workflow on-chain antes de crear la bóveda; de lo contrario quedaría inaccesible.";
      setError(message);
      toast.error(message, {
        description:
          "Usa «Publicar on-chain» en la barra inferior y vuelve a intentarlo.",
      });
      return;
    }
    setBusy("save");
    try {
      const values = parseForm();
      const args = {
        wallet: requireWallet(),
        owner: publicKey,
        workflowId,
        destination: values.destination,
        maxPerRunLamports: values.maxPerRunBaseUnits,
        maxTotalLamports: values.maxTotalBaseUnits,
        assetMint: values.assetMint,
        minIntervalSeconds: values.minIntervalSeconds,
        expiresAt: values.expiresAt,
        keeper: values.keeper,
      };
      const signature = policy
        ? await updateVaultPolicy(args)
        : await initializeVaultPolicy(args);
      setLastSignature(signature);
      setAuthorized(false);
      notifyTxSuccess(
        policy ? "Límites de la bóveda actualizados" : "Bóveda creada",
        signature,
      );
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo guardar la bóveda";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleDeposit = async () => {
    if (!publicKey) return;
    setError(null);
    setBusy("deposit");
    try {
      const amountBaseUnits = assetToBaseUnits(selectedAsset, depositAmount);
      const signature =
        selectedAsset === "SOL"
          ? await depositVaultSol({
              wallet: requireWallet(),
              owner: publicKey,
              workflowId,
              amountLamports: amountBaseUnits,
            })
          : await depositVaultSpl({
              wallet: requireWallet(),
              owner: publicKey,
              workflowId,
              mint: asset.mint,
              amountBaseUnits,
            });
      setLastSignature(signature);
      notifyTxSuccess(`${depositAmount} ${selectedAsset} depositados en la bóveda`, signature);
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo depositar";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleWithdraw = async () => {
    if (!publicKey || !snapshot) return;
    const amount =
      selectedAsset === "SOL"
        ? snapshot.balanceLamports - snapshot.rentExemptionLamports
        : Number(snapshot.tokenBalanceBaseUnits ?? BigInt(0));
    if (amount <= 0) {
      setError(
        selectedAsset === "SOL"
          ? "La bóveda no tiene fondos por encima del alquiler mínimo"
          : `La bóveda no tiene ${selectedAsset} disponible`,
      );
      return;
    }
    setError(null);
    setBusy("withdraw");
    try {
      const signature =
        selectedAsset === "SOL"
          ? await withdrawVaultSol({
              wallet: requireWallet(),
              owner: publicKey,
              workflowId,
              amountLamports: amount,
            })
          : await withdrawVaultSpl({
              wallet: requireWallet(),
              owner: publicKey,
              workflowId,
              mint: asset.mint,
              amountBaseUnits: amount,
            });
      setLastSignature(signature);
      notifyTxSuccess(
        `${baseUnitsToAmount(selectedAsset, amount)} ${selectedAsset} devueltos a tu wallet`,
        signature,
      );
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo retirar";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handlePause = async () => {
    if (!publicKey || !policy) return;
    setError(null);
    setBusy("pause");
    try {
      const signature = await setVaultPaused({
        wallet: requireWallet(),
        owner: publicKey,
        workflowId,
        paused: !policy.paused,
      });
      setLastSignature(signature);
      notifyTxSuccess(
        policy.paused ? "Bóveda reactivada" : "Bóveda pausada",
        signature,
      );
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo cambiar el estado";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const availableLamports = snapshot
    ? Math.max(0, snapshot.balanceLamports - snapshot.rentExemptionLamports)
    : 0;
  const availableBaseUnits =
    selectedAsset === "SOL"
      ? availableLamports
      : Number(snapshot?.tokenBalanceBaseUnits ?? BigInt(0));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          <button
            className="flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border px-2.5 py-2 text-xs hover:bg-muted sm:px-3 sm:text-sm"
            title="Bóveda con límites on-chain"
            aria-label="Abrir bóveda"
          >
            <Landmark className="h-4 w-4" />
            <span className="hidden sm:inline">Bóveda</span>
          </button>
        </SheetTrigger>
      )}

      <SheetContent className="w-full overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[480px] sm:max-w-[480px] sm:p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2 pr-8">
            <span className="flex min-w-0 items-center gap-2">
              <Landmark className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">Bóveda del workflow</span>
            </span>
            <button
              onClick={() => void refresh()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
              title="Actualizar"
              aria-label="Actualizar bóveda"
              disabled={busy === "refresh"}
            >
              <RefreshCw className={`h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
            </button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-amber-400/10 px-2 py-1 font-medium text-amber-300">
              {isDevnet ? "Devnet · experimental" : "Mainnet no habilitado"}
            </span>
            {policy ? (
              <span
                className={`rounded-full px-2 py-1 font-medium ${
                  policy.paused
                    ? "bg-red-400/10 text-red-300"
                    : "bg-emerald-400/10 text-emerald-300"
                }`}
              >
                {policy.paused ? "Pausada" : "Activa"}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                Sin configurar
              </span>
            )}
            {policy && executionEnabled === false && (
              <span className="rounded-full bg-amber-400/10 px-2 py-1 font-medium text-amber-300">
                Ejecución automática desactivada
              </span>
            )}
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
              {executionModeLabel(executionMode)}
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                La bóveda solo puede enviar al destino fijo y dentro de los límites que
                autorices. El ejecutor de la aplicación firma las transferencias con su
                propia llave y nunca recibe la tuya. La simulación del canvas firma desde
                tu wallet y no mueve fondos de la bóveda.
              </span>
            </p>
          </div>

          {!publicKey ? (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              Conecta tu wallet para configurar una bóveda.
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.12)]">
                  {error}
                </div>
              )}

              {!policy && !hasPublishedReference && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="min-w-0 flex-1">
                    Este workflow aún no está publicado on-chain. La bóveda
                    quedaría inaccesible si se pierde la sesión. Publícalo antes
                    de crearla.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event("publish-workflow"))}
                    className="rounded-lg border border-amber-400/50 px-3 py-1.5 font-medium transition-colors hover:bg-amber-400/10"
                  >
                    Publicar on-chain
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-card p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Workflow</span>
                  <span className="min-w-0 truncate font-mono text-foreground" title={workflowId}>
                    {workflowId ? shortAddr(workflowId, 8) : "—"}
                  </span>
                </div>
                {snapshot && (
                  <>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Saldo de la bóveda</span>
                      <span className="font-mono text-foreground">
                        {policyHasUnknownMint
                          ? "Activo no reconocido"
                          : policyAsset || (policy && policy.assetMint !== PublicKey.default.toBase58())
                            ? `${baseUnitsToAmount(displayAsset.symbol, snapshot.tokenBalanceBaseUnits ?? BigInt(0))} ${displayAsset.symbol}`
                            : `${lamportsToSol(snapshot.balanceLamports)} SOL`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Disponible para retirar</span>
                      <span className="font-mono text-foreground">
                        {policyHasUnknownMint
                          ? "—"
                          : `${baseUnitsToAmount(displayAsset.symbol, availableBaseUnits)} ${displayAsset.symbol}`}
                      </span>
                    </div>
                    {policy && (
                      <>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Gastado por la bóveda</span>
                          <span className="font-mono text-foreground">
                            {policyHasUnknownMint
                              ? "—"
                              : `${baseUnitsToAmount(displayAsset.symbol, policy.totalSpent)} ${displayAsset.symbol}`}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Última ejecución</span>
                          <span className="font-mono text-foreground">
                            {Number(policy.lastExecutionAt) > 0
                              ? new Date(Number(policy.lastExecutionAt) * 1000).toLocaleString()
                              : "Nunca"}
                          </span>
                        </div>
                      </>
                    )}
                    {executionEnabled === false && (
                      <p className="mt-2 rounded-lg border border-amber-600 bg-amber-950 p-2 text-[11px] leading-relaxed text-amber-100">
                        El ejecutor está pausado en el servidor (kill switch): las transferencias
                        programadas no se envían hasta reactivarlo. Por eso el saldo no cambia.
                      </p>
                    )}
                    {activity.length > 0 && (
                      <div className="mt-2 border-t border-border/40 pt-2">
                        <p className="mb-1 font-medium">Últimas transacciones de la bóveda</p>
                        <ul className="space-y-1">
                          {activity.map((item) => (
                            <li key={item.signature}>
                              <a
                                href={solexplorerUrl(item.signature)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-2 hover:underline"
                              >
                                <span className="font-mono text-[10px] text-foreground">
                                  {shortAddr(item.signature, 8)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.err ? "Fallida" : "Correcta"}
                                  {item.blockTime
                                    ? ` · ${new Date(item.blockTime * 1000).toLocaleString()}`
                                    : ""}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-2">
                      <a
                        href={explorerAddrUrl(snapshot.policy.toBase58())}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Política <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={explorerAddrUrl(snapshot.vault.toBase58())}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Vault <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </>
                )}
              </div>

              {policy && (
                <div className="rounded-xl border border-border/50 bg-card p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Límites on-chain
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Destino fijo</dt>
                      <dd className="truncate font-mono" title={policy.destination}>
                        {shortAddr(policy.destination, 6)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Ejecutor</dt>
                      <dd className="truncate font-mono" title={policy.keeper || ""}>
                        {policy.keeper ? `App · ${shortAddr(policy.keeper, 6)}` : "No configurado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Máx. por ejecución</dt>
                      <dd className="font-mono">
                        {policyHasUnknownMint
                          ? "—"
                          : `${baseUnitsToAmount(displayAsset.symbol, policy.maxPerRun)} ${displayAsset.symbol}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Máx. total</dt>
                      <dd className="font-mono">
                        {policyHasUnknownMint
                          ? "—"
                          : `${baseUnitsToAmount(displayAsset.symbol, policy.maxTotal)} ${displayAsset.symbol}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Gastado</dt>
                      <dd className="font-mono">
                        {policyHasUnknownMint
                          ? "—"
                          : `${baseUnitsToAmount(displayAsset.symbol, policy.totalSpent)} ${displayAsset.symbol}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Restante</dt>
                      <dd className="font-mono">
                        {policyHasUnknownMint
                          ? "—"
                          : `${baseUnitsToAmount(displayAsset.symbol, policy.maxTotal - policy.totalSpent)} ${displayAsset.symbol}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Intervalo mínimo</dt>
                      <dd>{formatInterval(policy.minIntervalSeconds)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Vence</dt>
                      <dd>{formatExpiry(policy.expiresAt)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Última ejecución</dt>
                      <dd>{formatTimestamp(policy.lastExecutionAt)}</dd>
                    </div>
                  </dl>
                  {policyHasUnknownMint && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Esta política usa un mint que no está en el registro de activos de la
                      bóveda. Solo se pueden mover fondos de los activos soportados.
                    </p>
                  )}
                  {policyAsset && !policyAssetSupported && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {policyAsset.symbol} no tiene un mint SPL válido en la red seleccionada.
                    </p>
                  )}
                </div>
              )}

              {executionMode !== "vault_transfer" && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    El modo actual es <b>{executionModeLabel(executionMode)}</b>. Para usar
                    esta bóveda, selecciona <b>Bóveda: transferencia</b> en la barra inferior.
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-card p-3">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-asset">
                  Activo de la bóveda
                </label>
                <select
                  id="vault-asset"
                  value={selectedAsset}
                  onChange={(event) => {
                    const next = normalizeVaultAsset(event.target.value) || "SOL";
                    setSelectedAsset(next);
                    setDepositAmount(next === "SOL" ? "0.005" : "1");
                    if (policyAsset?.symbol !== next) {
                      setMaxPerRun(next === "SOL" ? "0.01" : "1");
                      setMaxTotal(next === "SOL" ? "0.1" : "10");
                    }
                  }}
                  className={fieldClass()}
                >
                  {VAULT_ASSET_LIST.map((item) => {
                    const supported = isAssetSupportedOnCluster(item.symbol, cluster);
                    return (
                      <option key={item.symbol} value={item.symbol} disabled={!supported}>
                        {item.symbol}
                        {supported ? "" : " (sin mint en esta red)"}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Disponibles aquí: {supportedAssetLabel(cluster)}. Los límites se guardan en
                  la unidad mínima del activo.
                </p>
                {!assetSupported && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {selectedAsset} no tiene un mint SPL válido en esta red.
                  </p>
                )}
              </div>

              {policy && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="vault-deposit">
                      Depositar {selectedAsset}
                    </label>
                    <input
                      id="vault-deposit"
                      type="text"
                      inputMode="decimal"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      className={fieldClass()}
                      placeholder="0.005"
                    />
                    <button
                      onClick={() => void handleDeposit()}
                      disabled={Boolean(busy)}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === "deposit" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="h-4 w-4" />
                      )}
                      Depositar
                    </button>
                  </div>
                  <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Retirar fondos</p>
                    <p className="text-[11px] text-muted-foreground">
                      Deja el alquiler mínimo de la cuenta.
                    </p>
                    <button
                      onClick={() => void handleWithdraw()}
                      disabled={Boolean(busy) || availableBaseUnits <= 0}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {busy === "withdraw" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4" />
                      )}
                      Retirar todo
                    </button>
                  </div>
                  <button
                    onClick={() => void handlePause()}
                    disabled={Boolean(busy)}
                    className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium sm:col-span-2 ${
                      policy.paused
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        : "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    } disabled:opacity-50`}
                  >
                    {busy === "pause" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : policy.paused ? (
                      <UnlockKeyhole className="h-4 w-4" />
                    ) : (
                      <LockKeyhole className="h-4 w-4" />
                    )}
                    {policy.paused ? "Reactivar bóveda" : "Pausar bóveda"}
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {policy ? "Ajustar límites" : "Crear política y bóveda"}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-destination">
                      Destino autorizado
                    </label>
                    <input
                      id="vault-destination"
                      type="text"
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      className={fieldClass("font-mono text-xs sm:text-xs")}
                      placeholder="Wallet que recibe los fondos"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-max-run">
                      Máx. por ejecución ({selectedAsset})
                    </label>
                    <input
                      id="vault-max-run"
                      type="text"
                      inputMode="decimal"
                      value={maxPerRun}
                      onChange={(event) => setMaxPerRun(event.target.value)}
                      className={fieldClass()}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-max-total">
                      Máx. total ({selectedAsset})
                    </label>
                    <input
                      id="vault-max-total"
                      type="text"
                      inputMode="decimal"
                      value={maxTotal}
                      onChange={(event) => setMaxTotal(event.target.value)}
                      className={fieldClass()}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-interval">
                      Intervalo mínimo (min)
                    </label>
                    <input
                      id="vault-interval"
                      type="text"
                      inputMode="decimal"
                      value={intervalMinutes}
                      onChange={(event) => setIntervalMinutes(event.target.value)}
                      className={fieldClass()}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-expiry">
                      Vence (opcional)
                    </label>
                    <input
                      id="vault-expiry"
                      type="datetime-local"
                      value={expiry}
                      onChange={(event) => setExpiry(event.target.value)}
                      className={fieldClass()}
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Ejecutor gestionado por la aplicación
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Solo el ejecutor autorizado por la aplicación puede mover fondos. No
                      necesitas crear claves ni configurar direcciones técnicas.
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-foreground/80">
                      {keeperPubkey || (keeperError ? "No disponible" : "Cargando…")}
                    </p>
                    {keeperError && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        {keeperError}. Se requiere para crear o actualizar la bóveda.
                      </p>
                    )}
                    {policy && keeperPubkey && policy.keeper !== keeperPubkey && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        Esta política usa otro ejecutor. Marca la autorización y guarda
                        para alinearla con la aplicación.
                      </p>
                    )}
                    <details className="mt-2 text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer select-none">Opciones avanzadas</summary>
                      <label className="mt-2 block" htmlFor="vault-keeper">
                        Sobrescribir ejecutor (no recomendado)
                      </label>
                      <input
                        id="vault-keeper"
                        type="text"
                        value={keeper}
                        onChange={(event) => setKeeper(event.target.value)}
                        className={fieldClass("mt-1 font-mono text-xs")}
                        placeholder={keeperPubkey || "Dirección del ejecutor"}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </details>
                  </div>
                </div>

                <label className="mt-3 flex items-start gap-2 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={authorized}
                    onChange={(event) => setAuthorized(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                  />
                  <span>
                    Autorizo el destino y los límites on-chain de esta bóveda. El ejecutor
                    de la aplicación podrá mover fondos únicamente dentro de estos límites.
                  </span>
                </label>

                <button
                  onClick={() => void handleSubmit()}
                  disabled={Boolean(busy) || !isDevnet || !assetSupported}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-purple-cyan px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "save" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {policy ? "Guardar límites" : "Crear bóveda"}
                </button>
                {!isDevnet && (
                  <p className="mt-2 text-center text-[11px] text-red-300">
                    El programa de bóveda solo está desplegado en devnet.
                  </p>
                )}
              </div>

              {lastSignature && (
                <a
                  href={solscanUrl(lastSignature)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver última transacción <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <p className="break-all text-center text-[10px] text-muted-foreground">
                Programa: {VAULT_PROGRAM_ID.toBase58()}
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VaultPanel;
