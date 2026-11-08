# solana-flows-vault (Anchor program)

Status: SOL transfer path implemented, deployed to devnet, and covered by
LiteSVM plus a live devnet smoke test. Not audited. Mainnet and automated
transfers stay disabled until an external audit is complete.

Devnet program id: `dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA`

The first deployment supports SOL only. `execute_transfer_spl`,
`withdraw_spl`, `record_swap_out`, and Jupiter DCA remain planned; any policy
with a non-default `asset_mint` is rejected so funds cannot be locked in an
unsupported path.

## Custody model

One vault per workflow. The user's wallet is the only authority that can change
the policy, pause the vault, or withdraw. A permissionless crank may execute a
transfer only if every on-chain policy check passes. The crank never receives a
user private key and cannot redirect funds.

## PDAs

- Policy: `["vault-policy", owner, workflow_hash]`
- SOL vault: `["vault", owner, workflow_hash]` (system account, no data)
- SPL vault authority (planned): the SOL vault PDA. Token accounts are ATAs whose
  authority is this PDA.

`workflow_id` is a UTF-8 string, max 64 bytes. Solana limits each PDA seed to 32
bytes, so `workflow_hash = SHA-256(workflow_id)` is the actual seed. The policy
stores both the full id and the hash; the program rejects a hash that does not
match the id. Each workflow has its own policy and vault, so one compromised
workflow cannot drain another.

## Policy account

| Field | Type | Meaning |
| --- | --- | --- |
| `owner` | `Pubkey` | Only this wallet can update/withdraw. |
| `workflow_id` | `String` | Stable off-chain identity. |
| `workflow_hash` | `[u8; 32]` | SHA-256 of `workflow_id`; PDA seed. |
| `vault_bump` | `u8` | Bump for the vault PDA. |
| `destination` | `Pubkey` | Only allowed recipient for automated transfers. |
| `asset_mint` | `Pubkey` | Must be `Pubkey::default()` (SOL) in this deployment. |
| `max_per_run` | `u64` | Hard cap for one automated execution. |
| `max_total` | `u64` | Lifetime automated spend cap. |
| `min_interval_seconds` | `i64` | Minimum time between automated executions. |
| `total_spent` | `u64` | Monotonic counter updated on every execution. |
| `last_execution_at` | `i64` | Unix seconds. |
| `expires_at` | `i64` | `0` means no expiry. |
| `paused` | `bool` | User kill switch. |
| `keeper` | `Option<Pubkey>` | Optional allowlisted crank. `None` means permissionless. |

## Instructions

- `initialize_policy(workflow_id, workflow_hash, destination, asset_mint, max_per_run, max_total, min_interval_seconds, expires_at, keeper)` — owner signs; creates the policy PDA and the rent-exempt vault PDA. A pre-funded vault PDA is accepted when it is system-owned and empty.
- `update_policy(...)` — owner only. Tightening is immediate; any increase requires a new user signature. `total_spent` cannot be reset and `max_total` cannot be lowered below it.
- `set_paused(bool)` — owner only. Pausing blocks all automated execution.
- `deposit_sol(amount)` — owner signs a system transfer into the vault PDA.
- `withdraw_sol(amount)` — owner only; transfers from the vault PDA back to the owner. Must preserve rent exemption.
- `execute_transfer_sol(amount)` — crank signs. Checks `paused`, expiry, keeper, interval, `max_per_run`, `max_total`, destination, and rent exemption before signing a system transfer from the vault PDA.
- SPL and DCA instructions are planned; see Rollout.

## Devnet deployment

```bash
anchor build
anchor deploy --provider.cluster devnet --program-name solana-flows-vault
solana program show dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA --url devnet
```

The live smoke test (`node scripts/vault-smoke.mjs`) creates a throwaway owner,
initializes a policy, deposits SOL, executes a bounded transfer, verifies that
pausing blocks execution, and withdraws while preserving rent exemption. It is
devnet-only and spends devnet SOL from `~/.config/solana/id.json` (or
`ANCHOR_WALLET`). The browser panel in
`src/components/VaultPanel.tsx` derives the PDAs from
`owner + SHA-256(workflow_id)` and lets the owner initialize/update the policy,
deposit, pause, and withdraw on devnet. The frontend can override the program id
with `NEXT_PUBLIC_VAULT_PROGRAM_ID`.

The Supabase function `execute-vault` is the only crank entrypoint. It is
disabled unless `VAULT_EXECUTION_ENABLED=true`, requires
`VAULT_CRANK_SECRET_KEY`, and still enforces every policy check both before and
on-chain. The flag is intentionally `false` in production until the audit.

## Tests

```bash
anchor build
cargo test -p solana-flows-vault --test vault
```

Ten LiteSVM tests cover creation, deposits, per-run and lifetime caps, interval,
expiry, pause, keeper allowlisting, destination pinning, owner-only withdrawal,
rent preservation, pre-funded vaults, invalid policy parameters, hash mismatch,
and owner-only policy updates.

## Invariants tested

1. A non-owner cannot update the policy or withdraw.
2. A crank cannot send to any address other than `destination`.
3. `amount > max_per_run`, `total_spent + amount > max_total`, execution before
   `last_execution_at + min_interval_seconds`, expired policies, and paused
   policies all fail.
4. A failed CPI does not increment `total_spent` or `last_execution_at`.
5. SOL withdrawals cannot leave the vault below rent exemption.
6. Automated transfers also preserve rent exemption.
7. Revoking the keeper or pausing takes effect immediately.
8. The crank cannot use remaining accounts to substitute the destination, vault,
   or program.
9. A mismatched `workflow_hash` cannot create a policy.
10. A policy with a non-SOL `asset_mint` is rejected in this deployment.

## Rollout

1. Completed: SOL transfers with LiteSVM tests.
2. Completed: devnet deployment, live init/deposit/execute/pause/withdraw smoke
   test, and devnet program id in the browser client.
3. Completed: devnet-only vault panel and `execute-vault` crank path behind
   `VAULT_EXECUTION_ENABLED`.
4. Add SPL Token and Token-2022, including ATA ownership checks.
5. Add Jupiter CPI only after the transfer path is audited; measure output by
   vault balance delta and enforce a user-provided `min_out`.
6. External audit, then enable `VAULT_EXECUTION_ENABLED` and open mainnet.
