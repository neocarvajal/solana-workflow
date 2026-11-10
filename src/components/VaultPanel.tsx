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
  setVaultPaused,
  lamportsToSol,
  solToLamports,
  VAULT_PROGRAM_ID,
  type VaultPolicy,
  type VaultSnapshot,
  type VaultWallet,
} from "@/lib/vault";
import {
  getExecutionMode,
  getSettings,
  getWorkflowId,
  subscribeExecutionMode,
} from "@/lib/workflowStore";
import { executionModeLabel } from "@/lib/schedule";
import { explorerAddrUrl, shortAddr, solscanUrl, SOLANA_CLUSTER } from "@/lib/solana";
import { toast } from "sonner";

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
  const [authorized, setAuthorized] = useState(false);
  const [depositAmount, setDepositAmount] = useState("0.005");
  const [executionMode, setExecutionMode] = useState(getExecutionMode);

  const policy: VaultPolicy | null = snapshot?.policyData || null;
  const isDevnet = SOLANA_CLUSTER !== "mainnet-beta";

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
      if (next.policyData) {
        const current = next.policyData;
        setDestination(current.destination);
        setMaxPerRun(lamportsToSol(current.maxPerRun));
        setMaxTotal(lamportsToSol(current.maxTotal));
        setIntervalMinutes(String(Number(current.minIntervalSeconds) / 60));
        setExpiry(
          Number(current.expiresAt) > 0 ? toDatetimeLocal(current.expiresAt) : "",
        );
        setKeeper(current.keeper || "");
      } else {
        const settings = getSettings();
        setDestination((prev) => prev || settings.recipientWallet || publicKey.toBase58());
      }
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
    if (!open) return;
    void refresh();
  }, [open, refresh]);

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

    let keeperKey: PublicKey | null = null;
    if (keeper.trim()) {
      try {
        keeperKey = new PublicKey(keeper.trim());
      } catch {
        throw new Error("El keeper no es una dirección Solana válida");
      }
    }

    const maxPerRunLamports = solToLamports(maxPerRun);
    const maxTotalLamports = solToLamports(maxTotal);
    if (maxPerRunLamports <= 0) throw new Error("El máximo por ejecución debe ser mayor que cero");
    if (maxTotalLamports < maxPerRunLamports) {
      throw new Error("El máximo total no puede ser menor que el máximo por ejecución");
    }
    if (policy && BigInt(maxTotalLamports) < policy.totalSpent) {
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
      maxPerRunLamports,
      maxTotalLamports,
      minIntervalSeconds: Math.round(Number(intervalMinutes) * 60),
      expiresAt,
      keeper: keeperKey?.toBase58() || null,
    };
  };

  const handleSubmit = async () => {
    if (!publicKey) {
      setError("Conecta tu wallet para firmar");
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const values = parseForm();
      const args = {
        ...values,
        wallet: requireWallet(),
        owner: publicKey,
        workflowId,
      };
      const signature = policy
        ? await updateVaultPolicy(args)
        : await initializeVaultPolicy(args);
      setLastSignature(signature);
      setAuthorized(false);
      toast.success(policy ? "Límites de la bóveda actualizados" : "Bóveda creada en devnet");
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
      const amountLamports = solToLamports(depositAmount);
      const signature = await depositVaultSol({
        wallet: requireWallet(),
        owner: publicKey,
        workflowId,
        amountLamports,
      });
      setLastSignature(signature);
      toast.success(`${depositAmount} SOL depositados en la bóveda`);
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
    const amount = snapshot.balanceLamports - snapshot.rentExemptionLamports;
    if (amount <= 0) {
      setError("La bóveda no tiene fondos por encima del alquiler mínimo");
      return;
    }
    setError(null);
    setBusy("withdraw");
    try {
      const signature = await withdrawVaultSol({
        wallet: requireWallet(),
        owner: publicKey,
        workflowId,
        amountLamports: amount,
      });
      setLastSignature(signature);
      toast.success(`${lamportsToSol(amount)} SOL devueltos a tu wallet`);
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
      toast.success(policy.paused ? "Bóveda reactivada" : "Bóveda pausada");
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
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
              {executionModeLabel(executionMode)}
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                La bóveda solo puede enviar al destino fijo y dentro de los límites que
                autorices. El crank no recibe tu llave. En esta fase la ejecución
                automática de fondos sigue desactivada hasta completar la auditoría;
                esta configuración es de devnet.
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
                        {lamportsToSol(snapshot.balanceLamports)} SOL
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Disponible para retirar</span>
                      <span className="font-mono text-foreground">
                        {lamportsToSol(availableLamports)} SOL
                      </span>
                    </div>
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
                      <dt className="text-muted-foreground">Keeper</dt>
                      <dd className="truncate font-mono" title={policy.keeper || "Permissionless"}>
                        {policy.keeper ? shortAddr(policy.keeper, 6) : "Permissionless"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Máx. por ejecución</dt>
                      <dd className="font-mono">{lamportsToSol(policy.maxPerRun)} SOL</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Máx. total</dt>
                      <dd className="font-mono">{lamportsToSol(policy.maxTotal)} SOL</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Gastado</dt>
                      <dd className="font-mono">{lamportsToSol(policy.totalSpent)} SOL</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Restante</dt>
                      <dd className="font-mono">
                        {lamportsToSol(policy.maxTotal - policy.totalSpent)} SOL
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
                  {policy.assetMint !== PublicKey.default.toBase58() && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Esta política usa un mint no soportado por esta versión.
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

              {policy && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="vault-deposit">
                      Depositar SOL
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
                      disabled={Boolean(busy) || availableLamports <= 0}
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
                      Máx. por ejecución (SOL)
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
                      Máx. total (SOL)
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
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="vault-keeper">
                      Keeper (opcional)
                    </label>
                    <input
                      id="vault-keeper"
                      type="text"
                      value={keeper}
                      onChange={(event) => setKeeper(event.target.value)}
                      className={fieldClass("font-mono text-xs sm:text-xs")}
                      placeholder="Vacío = cualquier crank"
                      spellCheck={false}
                      autoComplete="off"
                    />
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
                    Autorizo explícitamente que el crank del workflow pueda mover fondos
                    desde esta bóveda, únicamente al destino y dentro de estos límites
                    on-chain.
                  </span>
                </label>

                <button
                  onClick={() => void handleSubmit()}
                  disabled={Boolean(busy) || !isDevnet}
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
