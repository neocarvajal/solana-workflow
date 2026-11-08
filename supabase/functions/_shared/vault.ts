import { Buffer } from "node:buffer";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "npm:@solana/web3.js@1.99.0";
import bs58 from "npm:bs58@6.0.0";

export const VAULT_PROGRAM_ID = new PublicKey(
  Deno.env.get("VAULT_PROGRAM_ID") ||
    "dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA",
);

export const POLICY_SEED = "vault-policy";
export const VAULT_SEED = "vault";
const MAX_WORKFLOW_ID_BYTES = 64;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type VaultPolicy = {
  owner: PublicKey;
  workflowId: string;
  workflowHash: Uint8Array;
  destination: PublicKey;
  assetMint: PublicKey;
  maxPerRun: bigint;
  maxTotal: bigint;
  minIntervalSeconds: bigint;
  totalSpent: bigint;
  lastExecutionAt: bigint;
  expiresAt: bigint;
  paused: boolean;
  keeper: PublicKey | null;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-cron-secret",
      "Content-Type": "application/json",
    },
  });
}

export function loadCrank(): Keypair {
  const raw = Deno.env.get("VAULT_CRANK_SECRET_KEY");
  if (!raw) throw new Error("VAULT_CRANK_SECRET_KEY is not configured");
  const value = raw.trim();
  if (value.startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value)));
  }
  return Keypair.fromSecretKey(bs58.decode(value));
}

export async function sha256(value: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
}

export async function getVaultAddresses(
  owner: PublicKey,
  workflowId: string,
): Promise<{ policy: PublicKey; vault: PublicKey; workflowHash: Uint8Array }> {
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

function readPubkey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32));
}

export async function decodeVaultPolicy(
  data: Uint8Array,
): Promise<VaultPolicy | null> {
  const fixedLength = 8 + 32 + 4 + 32 + 32 + 32 + 8 * 6 + 1 + 1 + 1 + 1;
  if (data.length < fixedLength) return null;

  const expectedDiscriminator = await sha256("account:VaultPolicy");
  for (let index = 0; index < 8; index += 1) {
    if (data[index] !== expectedDiscriminator[index]) return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;
  const owner = readPubkey(data, offset);
  offset += 32;
  const workflowIdLength = view.getUint32(offset, true);
  offset += 4;
  if (
    workflowIdLength > MAX_WORKFLOW_ID_BYTES ||
    offset + workflowIdLength > data.length
  ) {
    return null;
  }
  const workflowId = textDecoder.decode(
    data.subarray(offset, offset + workflowIdLength),
  );
  offset += workflowIdLength;
  const workflowHash = Uint8Array.from(data.subarray(offset, offset + 32));
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
  const keeper = hasKeeper ? readPubkey(data, offset) : null;
  if (hasKeeper) offset += 32;

  return {
    owner,
    workflowId,
    workflowHash,
    destination,
    assetMint,
    maxPerRun,
    maxTotal,
    minIntervalSeconds,
    totalSpent,
    lastExecutionAt,
    expiresAt,
    paused,
    keeper,
  };
}

function encodeU64(value: number | bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value), 0);
  return buffer;
}

export async function buildExecuteTransferSolInstruction(args: {
  policy: PublicKey;
  vault: PublicKey;
  destination: PublicKey;
  crank: PublicKey;
  amountLamports: number | bigint;
}): Promise<TransactionInstruction> {
  const discriminator = (await sha256("global:execute_transfer_sol")).subarray(
    0,
    8,
  );
  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: args.policy, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: args.destination, isSigner: false, isWritable: true },
      { pubkey: args.crank, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      Buffer.from(discriminator),
      encodeU64(args.amountLamports),
    ]),
  });
}
