import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { connection as appConnection } from "@/lib/solana";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const VAULT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
    "dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA",
);

const POLICY_SEED = "vault-policy";
const VAULT_SEED = "vault";
const MAX_WORKFLOW_ID_BYTES = 64;
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Unique marker so a landed transaction can be recognised after a wallet/RPC error. */
function makeTxReference(): string {
  const uuid = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `solflows-vault:${uuid}`;
}

export type VaultPolicy = {
  owner: string;
  workflowId: string;
  workflowHash: Uint8Array;
  destination: string;
  assetMint: string;
  maxPerRun: bigint;
  maxTotal: bigint;
  minIntervalSeconds: bigint;
  totalSpent: bigint;
  lastExecutionAt: bigint;
  expiresAt: bigint;
  paused: boolean;
  keeper: string | null;
  vaultBump: number;
  bump: number;
};

export type VaultAddresses = {
  policy: PublicKey;
  vault: PublicKey;
  workflowHash: Uint8Array;
};

export type VaultSnapshot = VaultAddresses & {
  policyData: VaultPolicy | null;
  balanceLamports: number;
  rentExemptionLamports: number;
  /** Vault ATA balance in the policy's smallest token unit; null for SOL. */
  tokenBalanceBaseUnits: bigint | null;
};

export type VaultWallet = {
  publicKey: PublicKey | null;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: { skipPreflight?: boolean; preflightCommitment?: string },
  ) => Promise<string>;
};

async function sha256(value: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(digest);
}

export async function getVaultAddresses(
  owner: PublicKey,
  workflowId: string,
): Promise<VaultAddresses> {
  const workflowHash = await sha256(workflowId);
  const policy = PublicKey.findProgramAddressSync(
    [Buffer.from(POLICY_SEED), owner.toBuffer(), Buffer.from(workflowHash)],
    VAULT_PROGRAM_ID,
  )[0];
  const vault = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), owner.toBuffer(), Buffer.from(workflowHash)],
    VAULT_PROGRAM_ID,
  )[0];
  return { policy, vault, workflowHash };
}

function encodeU32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function encodeU64(value: number | bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

function encodeI64(value: number | bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(BigInt(value), 0);
  return buffer;
}

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([encodeU32(bytes.length), bytes]);
}

function encodeOptionPubkey(value: PublicKey | null | undefined): Buffer {
  return value
    ? Buffer.concat([Buffer.from([1]), value.toBuffer()])
    : Buffer.from([0]);
}

async function discriminator(name: string): Promise<Buffer> {
  const hash = await sha256(`global:${name}`);
  return Buffer.from(hash.subarray(0, 8));
}

export function solToLamports(value: string | number): number {
  const raw = String(value).trim();
  if (!/^\d*(\.\d*)?$/.test(raw) || raw === "" || raw === ".") {
    throw new Error("Importe SOL inválido");
  }
  const [whole, fraction = ""] = raw.split(".");
  const padded = (fraction + "000000000").slice(0, 9);
  const lamports = Number(whole || "0") * 1_000_000_000 + Number(padded || "0");
  if (!Number.isSafeInteger(lamports)) {
    throw new Error("El importe SOL es demasiado grande");
  }
  return lamports;
}

export function lamportsToSol(lamports: number | bigint, digits = 6): string {
  const value = Number(lamports) / 1_000_000_000;
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function readPubkey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32));
}

export function decodeVaultPolicy(data: Uint8Array): VaultPolicy | null {
  const fixedLength = 8 + 32 + 4 + 32 + 32 + 32 + 8 * 6 + 1 + 1 + 1 + 1;
  if (data.length < fixedLength) {
    return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;
  const owner = readPubkey(data, offset);
  offset += 32;
  const workflowIdLength = view.getUint32(offset, true);
  offset += 4;
  if (workflowIdLength > MAX_WORKFLOW_ID_BYTES || offset + workflowIdLength > data.length) {
    return null;
  }
  const workflowId = textDecoder.decode(data.subarray(offset, offset + workflowIdLength));
  offset += workflowIdLength;
  const workflowHash = data.subarray(offset, offset + 32);
  offset += 32;
  const destination = readPubkey(data, offset);
  offset += 32;
  const assetMint = readPubkey(data, offset);
  offset += 32;
  const maxPerRun = view.getBigUint64(offset, true);
  offset += 8;
  const maxTotal = view.getBigUint64(offset, true);
  offset += 8;
  const minIntervalSeconds = view.getBigInt64(offset, true);
  offset += 8;
  const totalSpent = view.getBigUint64(offset, true);
  offset += 8;
  const lastExecutionAt = view.getBigInt64(offset, true);
  offset += 8;
  const expiresAt = view.getBigInt64(offset, true);
  offset += 8;
  const paused = data[offset] === 1;
  offset += 1;
  const hasKeeper = data[offset] === 1;
  offset += 1;
  if (offset + (hasKeeper ? 32 : 0) + 2 > data.length) return null;
  const keeper = hasKeeper ? readPubkey(data, offset).toBase58() : null;
  if (hasKeeper) offset += 32;
  const vaultBump = data[offset];
  offset += 1;
  const bump = data[offset];

  return {
    owner: owner.toBase58(),
    workflowId,
    workflowHash,
    destination: destination.toBase58(),
    assetMint: assetMint.toBase58(),
    maxPerRun,
    maxTotal,
    minIntervalSeconds,
    totalSpent,
    lastExecutionAt,
    expiresAt,
    paused,
    keeper,
    vaultBump,
    bump,
  };
}

export type VaultActivity = {
  signature: string;
  blockTime: number | null;
  err: unknown | null;
};

export async function fetchVaultActivity(
  vault: PublicKey,
  limit = 5,
  connection: Connection = appConnection,
): Promise<VaultActivity[]> {
  const signatures = await connection.getSignaturesForAddress(vault, { limit });
  return signatures.map((entry) => ({
    signature: entry.signature,
    blockTime: entry.blockTime ?? null,
    err: entry.err ?? null,
  }));
}

export async function fetchVaultSnapshot(
  owner: PublicKey,
  workflowId: string,
  connection: Connection = appConnection,
): Promise<VaultSnapshot> {
  const addresses = await getVaultAddresses(owner, workflowId);
  const [account, balanceLamports, rentExemptionLamports] = await Promise.all([
    connection.getAccountInfo(addresses.policy),
    connection.getBalance(addresses.vault),
    connection.getMinimumBalanceForRentExemption(0),
  ]);

  if (account && !account.owner.equals(VAULT_PROGRAM_ID)) {
    throw new Error("La cuenta de política no pertenece al programa de bóveda");
  }
  const policyData = account ? decodeVaultPolicy(account.data) : null;
  if (account && !policyData) {
    throw new Error("No se pudo leer la política de la bóveda");
  }

  let tokenBalanceBaseUnits: bigint | null = null;
  if (policyData && policyData.assetMint !== PublicKey.default.toBase58()) {
    const mint = new PublicKey(policyData.assetMint);
    const vaultAta = getAssociatedTokenAddressSync(mint, addresses.vault, true);
    const ataAccount = await connection.getAccountInfo(vaultAta);
    tokenBalanceBaseUnits = ataAccount
      ? BigInt((await connection.getTokenAccountBalance(vaultAta)).value.amount)
      : BigInt(0);
  }

  return {
    ...addresses,
    policyData,
    balanceLamports,
    rentExemptionLamports,
    tokenBalanceBaseUnits,
  };
}

/** True when an on-chain policy already exists for this workflow. */
export async function isVaultConfigured(
  owner: PublicKey,
  workflowId: string,
  connection: Connection = appConnection,
): Promise<boolean> {
  const snapshot = await fetchVaultSnapshot(owner, workflowId, connection);
  return Boolean(snapshot.policyData);
}

/**
 * Waits for a signature using HTTP signature statuses only.
 *
 * Wallet adapters such as Phantom broadcast through their own RPC and may use a
 * fresher blockhash than the one attached here. `connection.confirmTransaction`
 * with a blockhash strategy then throws `TransactionExpiredBlockheightExceededError`
 * (or its devnet WebSocket subscription drops) even though the transaction
 * already landed. Polling `getSignatureStatuses` avoids both false failures.
 */
async function confirmVaultSignature(
  connection: Connection,
  signature: string,
): Promise<void> {
  const POLL_INTERVAL_MS = 1_000;
  const TIMEOUT_MS = 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];
    if (status) {
      if (status.err) {
        throw new Error(
          `La transacción falló en la red: ${JSON.stringify(status.err)}`,
        );
      }
      if (
        status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized"
      ) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // The signature may be known without an explicit commitment level. If there
  // is no error the transaction landed, so do not report a false failure.
  const { value } = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  if (value[0] && !value[0].err) return;
  throw new Error(
    "La transacción fue enviada pero no se pudo confirmar a tiempo. Revisa el explorer antes de reintentar.",
  );
}

/**
 * Best-effort lookup of a transaction that reached the cluster even when the
 * wallet or RPC reported an error. The memo reference attached to every vault
 * transaction makes the match unambiguous.
 */
async function findLandedReference(
  connection: Connection,
  owner: PublicKey,
  reference: string,
): Promise<string | null> {
  try {
    const signatures = await connection.getSignaturesForAddress(owner, { limit: 25 });
    const transactions = await connection.getTransactions(
      signatures.map((entry) => entry.signature),
      { commitment: "confirmed", maxSupportedTransactionVersion: 1 },
    );
    for (let i = 0; i < transactions.length; i++) {
      const meta = transactions[i]?.meta;
      if (!meta || meta.err) continue;
      if ((meta.logMessages || []).some((line) => line.includes(reference))) {
        return signatures[i].signature;
      }
    }
  } catch {
    // Reconciliation is opportunistic; the original error is still reported.
  }
  return null;
}

async function sendVaultTransaction(
  wallet: VaultWallet,
  instructions: TransactionInstruction[],
  connection: Connection,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Conecta tu wallet para firmar");
  const reference = makeTxReference();
  const transaction = new Transaction()
    .add(...instructions)
    .add(new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(reference, "utf8"),
    }));
  transaction.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  try {
    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await confirmVaultSignature(connection, signature);
    return signature;
  } catch (error) {
    // A wallet may broadcast through its own RPC and then fail while waiting
    // for its own confirmation, and an RPC can return a transient "Internal
    // error" for a transaction that already landed. Never report a false
    // failure when the memo shows the operation succeeded on chain.
    const landed = await findLandedReference(connection, wallet.publicKey, reference);
    if (landed) return landed;
    throw error;
  }
}

async function initializeInstruction(args: {
  owner: PublicKey;
  policy: PublicKey;
  vault: PublicKey;
  workflowId: string;
  workflowHash: Uint8Array;
  destination: PublicKey;
  assetMint: PublicKey;
  maxPerRun: number;
  maxTotal: number;
  minIntervalSeconds: number;
  expiresAt: number;
  keeper: PublicKey | null;
}): Promise<TransactionInstruction> {
  if (!args.workflowId || Buffer.byteLength(args.workflowId) > MAX_WORKFLOW_ID_BYTES) {
    throw new Error("El workflow no tiene un identificador válido");
  }
  const data = Buffer.concat([
    await discriminator("initialize_policy"),
    encodeString(args.workflowId),
    Buffer.from(args.workflowHash),
    args.destination.toBuffer(),
    args.assetMint.toBuffer(),
    encodeU64(args.maxPerRun),
    encodeU64(args.maxTotal),
    encodeI64(args.minIntervalSeconds),
    encodeI64(args.expiresAt),
    encodeOptionPubkey(args.keeper),
  ]);

  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: true },
      { pubkey: args.policy, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function initializeVaultPolicy(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  destination: string;
  maxPerRunLamports: number;
  maxTotalLamports: number;
  minIntervalSeconds: number;
  expiresAt: number;
  keeper?: string | null;
  assetMint?: string;
  connection?: Connection;
}): Promise<string> {
  const connection = args.connection || appConnection;
  const destination = new PublicKey(args.destination);
  const assetMint = args.assetMint?.trim()
    ? new PublicKey(args.assetMint.trim())
    : PublicKey.default;
  const keeper = args.keeper?.trim() ? new PublicKey(args.keeper.trim()) : null;
  if (!keeper) throw new Error("La política requiere un ejecutor autorizado");
  const addresses = await getVaultAddresses(args.owner, args.workflowId);
  if (destination.equals(addresses.vault)) {
    throw new Error("El destino no puede ser la propia bóveda");
  }
  if (destination.equals(addresses.policy)) {
    throw new Error("El destino no puede ser la cuenta de política");
  }
  const instruction = await initializeInstruction({
    owner: args.owner,
    policy: addresses.policy,
    vault: addresses.vault,
    workflowId: args.workflowId,
    workflowHash: addresses.workflowHash,
    destination,
    assetMint,
    maxPerRun: args.maxPerRunLamports,
    maxTotal: args.maxTotalLamports,
    minIntervalSeconds: args.minIntervalSeconds,
    expiresAt: args.expiresAt,
    keeper,
  });
  return sendVaultTransaction(args.wallet, [instruction], connection);
}

export async function updateVaultPolicy(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  destination: string;
  maxPerRunLamports: number;
  maxTotalLamports: number;
  minIntervalSeconds: number;
  expiresAt: number;
  keeper?: string | null;
  assetMint?: string;
  connection?: Connection;
}): Promise<string> {
  const connection = args.connection || appConnection;
  const destination = new PublicKey(args.destination);
  const assetMint = args.assetMint?.trim()
    ? new PublicKey(args.assetMint.trim())
    : PublicKey.default;
  const keeper = args.keeper?.trim() ? new PublicKey(args.keeper.trim()) : null;
  if (!keeper) throw new Error("La política requiere un ejecutor autorizado");
  const { policy, vault } = await getVaultAddresses(args.owner, args.workflowId);
  if (destination.equals(vault)) {
    throw new Error("El destino no puede ser la propia bóveda");
  }
  if (destination.equals(policy)) {
    throw new Error("El destino no puede ser la cuenta de política");
  }
  const data = Buffer.concat([
    await discriminator("update_policy"),
    destination.toBuffer(),
    encodeU64(args.maxPerRunLamports),
    encodeU64(args.maxTotalLamports),
    encodeI64(args.minIntervalSeconds),
    encodeI64(args.expiresAt),
    encodeOptionPubkey(keeper),
    assetMint.toBuffer(),
  ]);
  const instruction = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: true },
    ],
    data,
  });
  return sendVaultTransaction(args.wallet, [instruction], connection);
}

export async function depositVaultSol(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  amountLamports: number;
  connection?: Connection;
}): Promise<string> {
  if (args.amountLamports <= 0) throw new Error("El depósito debe ser mayor que cero");
  const connection = args.connection || appConnection;
  const { policy, vault } = await getVaultAddresses(args.owner, args.workflowId);
  const instruction = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([await discriminator("deposit_sol"), encodeU64(args.amountLamports)]),
  });
  return sendVaultTransaction(args.wallet, [instruction], connection);
}

export async function withdrawVaultSol(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  amountLamports: number;
  connection?: Connection;
}): Promise<string> {
  if (args.amountLamports <= 0) throw new Error("No hay fondos disponibles para retirar");
  const connection = args.connection || appConnection;
  const { policy, vault } = await getVaultAddresses(args.owner, args.workflowId);
  const instruction = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([await discriminator("withdraw_sol"), encodeU64(args.amountLamports)]),
  });
  return sendVaultTransaction(args.wallet, [instruction], connection);
}

export async function setVaultPaused(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  paused: boolean;
  connection?: Connection;
}): Promise<string> {
  const connection = args.connection || appConnection;
  const { policy } = await getVaultAddresses(args.owner, args.workflowId);
  const instruction = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([await discriminator("set_paused"), Buffer.from([args.paused ? 1 : 0])]),
  });
  return sendVaultTransaction(args.wallet, [instruction], connection);
}

async function ensureTokenAccounts(args: {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  connection: Connection;
}): Promise<TransactionInstruction[]> {
  const ownerAta = getAssociatedTokenAddressSync(args.mint, args.owner, true);
  const vaultAta = getAssociatedTokenAddressSync(args.mint, args.vault, true);
  const [ownerAtaAccount, vaultAtaAccount] = await Promise.all([
    args.connection.getAccountInfo(ownerAta),
    args.connection.getAccountInfo(vaultAta),
  ]);
  const instructions: TransactionInstruction[] = [];
  if (!ownerAtaAccount) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.owner,
        ownerAta,
        args.owner,
        args.mint,
      ),
    );
  }
  if (!vaultAtaAccount) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        args.owner,
        vaultAta,
        args.vault,
        args.mint,
      ),
    );
  }
  return instructions;
}

export async function depositVaultSpl(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  mint: string;
  amountBaseUnits: number;
  connection?: Connection;
}): Promise<string> {
  if (args.amountBaseUnits <= 0) {
    throw new Error("El depósito debe ser mayor que cero");
  }
  const connection = args.connection || appConnection;
  const mint = new PublicKey(args.mint);
  if (mint.equals(PublicKey.default)) {
    throw new Error("Usa depositVaultSol para depositar SOL");
  }
  const { policy, vault } = await getVaultAddresses(args.owner, args.workflowId);
  const setup = await ensureTokenAccounts({
    owner: args.owner,
    vault,
    mint,
    connection,
  });
  const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
  const ownerAta = getAssociatedTokenAddressSync(mint, args.owner, true);
  const instruction = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      await discriminator("deposit_spl"),
      encodeU64(args.amountBaseUnits),
    ]),
  });
  return sendVaultTransaction(args.wallet, [...setup, instruction], connection);
}

export async function withdrawVaultSpl(args: {
  wallet: VaultWallet;
  owner: PublicKey;
  workflowId: string;
  mint: string;
  amountBaseUnits: number;
  connection?: Connection;
}): Promise<string> {
  if (args.amountBaseUnits <= 0) {
    throw new Error("No hay fondos disponibles para retirar");
  }
  const connection = args.connection || appConnection;
  const mint = new PublicKey(args.mint);
  if (mint.equals(PublicKey.default)) {
    throw new Error("Usa withdrawVaultSol para retirar SOL");
  }
  const { policy, vault } = await getVaultAddresses(args.owner, args.workflowId);
  const setup = await ensureTokenAccounts({
    owner: args.owner,
    vault,
    mint,
    connection,
  });
  const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
  const ownerAta = getAssociatedTokenAddressSync(mint, args.owner, true);
  const instruction = new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.owner, isSigner: true, isWritable: false },
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      await discriminator("withdraw_spl"),
      encodeU64(args.amountBaseUnits),
    ]),
  });
  return sendVaultTransaction(args.wallet, [...setup, instruction], connection);
}
