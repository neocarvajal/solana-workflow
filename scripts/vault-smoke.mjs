// Devnet-only smoke test for solana-flows-vault.
// It funds a throwaway owner from ~/.config/solana/id.json and spends devnet SOL.
// Usage: node scripts/vault-smoke.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA");
const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

const disc = (name) =>
  createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
const u64 = (n) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};
const i64 = (n) => {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
};
const optionPubkey = (key) =>
  key ? Buffer.concat([Buffer.from([1]), key.toBuffer()]) : Buffer.from([0]);

function loadWallet() {
  const walletPath =
    process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config/solana/id.json");
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8"))),
  );
}

function pda(seed, owner, hash) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed), owner.toBuffer(), Buffer.from(hash)],
    PROGRAM_ID,
  )[0];
}

async function send(label, ixs, signers) {
  const tx = new Transaction().add(...ixs);
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, signers, {
      commitment: "confirmed",
      maxRetries: 5,
    });
    console.log(`✅ ${label}: ${sig}`);
    return sig;
  } catch (error) {
    console.error(`❌ ${label}`);
    console.error(error?.logs || error);
    throw error;
  }
}

const owner = Keypair.generate();
const destination = Keypair.generate().publicKey;
const funder = loadWallet();
const workflowId = `devnet-smoke-${Date.now()}`;
const workflowHash = createHash("sha256").update(workflowId).digest();
const policy = pda("vault-policy", owner.publicKey, workflowHash);
const vault = pda("vault", owner.publicKey, workflowHash);
const rent = await connection.getMinimumBalanceForRentExemption(0);

console.log({
  rpc: RPC,
  workflowId,
  owner: owner.publicKey.toBase58(),
  destination: destination.toBase58(),
  policy: policy.toBase58(),
  vault: vault.toBase58(),
  rent,
});

await send(
  "fund throwaway owner",
  [
    SystemProgram.transfer({
      fromPubkey: funder.publicKey,
      toPubkey: owner.publicKey,
      lamports: 50_000_000,
    }),
  ],
  [funder],
);

const initData = Buffer.concat([
  disc("initialize_policy"),
  u32(Buffer.byteLength(workflowId)),
  Buffer.from(workflowId),
  workflowHash,
  destination.toBuffer(),
  PublicKey.default.toBuffer(),
  u64(1_000_000),
  u64(2_000_000),
  i64(0),
  i64(0),
  optionPubkey(null),
]);
await send(
  "initialize_policy",
  [
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: policy, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initData,
    }),
  ],
  [owner],
);

const policyAccount = await connection.getAccountInfo(policy);
if (!policyAccount) throw new Error("policy account was not created");
console.log("policy account", {
  owner: policyAccount.owner.toBase58(),
  dataLength: policyAccount.data.length,
});

await send(
  "deposit_sol",
  [
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: policy, isSigner: false, isWritable: false },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc("deposit_sol"), u64(2_000_000)]),
    }),
  ],
  [owner],
);

await send(
  "execute_transfer_sol",
  [
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: policy, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: owner.publicKey, isSigner: true, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc("execute_transfer_sol"), u64(1_000_000)]),
    }),
  ],
  [owner],
);

const destinationBalance = await connection.getBalance(destination);
if (destinationBalance !== 1_000_000) {
  throw new Error(`unexpected destination balance: ${destinationBalance}`);
}
console.log("✅ destination received", destinationBalance, "lamports");

await send(
  "set_paused(true)",
  [
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: false },
        { pubkey: policy, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([disc("set_paused"), Buffer.from([1])]),
    }),
  ],
  [owner],
);

const blockedTx = new Transaction().add(
  new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: policy, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner.publicKey, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("execute_transfer_sol"), u64(100_000)]),
  }),
);
blockedTx.feePayer = owner.publicKey;
blockedTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
blockedTx.sign(owner);
const blocked = await connection.simulateTransaction(blockedTx);
if (!blocked.value.err) throw new Error("paused policy did not block execution");
console.log("✅ paused policy blocked execution", blocked.value.err);

await send(
  "set_paused(false)",
  [
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: false },
        { pubkey: policy, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([disc("set_paused"), Buffer.from([0])]),
    }),
  ],
  [owner],
);

const vaultBalance = await connection.getBalance(vault);
const withdrawAmount = vaultBalance - rent;
await send(
  "withdraw_sol",
  [
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: true },
        { pubkey: policy, isSigner: false, isWritable: false },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc("withdraw_sol"), u64(withdrawAmount)]),
    }),
  ],
  [owner],
);

const finalVaultBalance = await connection.getBalance(vault);
if (finalVaultBalance !== rent) {
  throw new Error(`vault rent not preserved: ${finalVaultBalance} != ${rent}`);
}
console.log("✅ vault rent preserved", finalVaultBalance, "lamports");
console.log("devnet vault smoke test passed");
