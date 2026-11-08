import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { connection as appConnection } from "@/lib/solana";

export const VAULT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID ||
    "dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA",
);

const POLICY_SEED = "vault-policy";
const VAULT_SEED = "vault";
const MAX_WORKFLOW_ID_BYTES = 64;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

  return { ...addresses, policyData, balanceLamports, rentExemptionLamports };
}

async function sendVaultTransaction(
  wallet: VaultWallet,
  instructions: TransactionInstruction[],
  connection: Connection,
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Conecta tu wallet para firmar");
  const transaction = new Transaction().add(...instructions);
  transaction.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  const signature = await wallet.sendTransaction(transaction, connection, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}

async function initializeInstruction(args: {
  owner: PublicKey;
  policy: PublicKey;
  vault: PublicKey;
  workflowId: string;
  workflowHash: Uint8Array;
  destination: PublicKey;
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
    PublicKey.default.toBuffer(),
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
  connection?: Connection;
}): Promise<string> {
  const connection = args.connection || appConnection;
  const destination = new PublicKey(args.destination);
  const keeper = args.keeper?.trim() ? new PublicKey(args.keeper.trim()) : null;
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
  connection?: Connection;
}): Promise<string> {
  const connection = args.connection || appConnection;
  const destination = new PublicKey(args.destination);
  const keeper = args.keeper?.trim() ? new PublicKey(args.keeper.trim()) : null;
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
