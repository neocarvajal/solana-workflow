# solana-flows-vault (Anchor program)

Status: design only. Not deployed. Financial automation must remain inactive
until this program is built, tested on devnet, and audited.

## Custody model

One vault per workflow. The user's wallet is the only authority that can change
the policy, pause the vault, or withdraw. A permissionless crank may execute a
transfer only if every on-chain policy check passes. The crank never receives a
user private key and cannot redirect funds.

## PDAs

- Policy: `["vault-policy", owner, workflow_id]`
- SOL vault: `["vault", owner, workflow_id]` (system account, no data)
- SPL vault authority: the SOL vault PDA. Token accounts are ATAs whose authority
  is this PDA.

`workflow_id` is a UTF-8 string, max 64 bytes. Each workflow has its own policy
and vault, so one compromised workflow cannot drain another.

## Policy account

| Field | Type | Meaning |
| --- | --- | --- |
| `owner` | `Pubkey` | Only this wallet can update/withdraw. |
| `workflow_id` | `String` | Stable off-chain identity. |
| `vault_bump` | `u8` | Bump for the vault PDA. |
| `destination` | `Pubkey` | Only allowed recipient for automated transfers. |
| `asset_mint` | `Pubkey` | `Pubkey::default()` for SOL, otherwise the SPL/Token-2022 mint. |
| `max_per_run` | `u64` | Hard cap for one automated execution. |
| `max_total` | `u64` | Lifetime automated spend cap. |
| `min_interval_seconds` | `i64` | Minimum time between automated executions. |
| `total_spent` | `u64` | Monotonic counter updated on every execution. |
| `last_execution_at` | `i64` | Unix seconds. |
| `expires_at` | `i64` | `0` means no expiry. |
| `paused` | `bool` | User kill switch. |
| `keeper` | `Option<Pubkey>` | Optional allowlisted crank. `None` means permissionless. |

## Instructions

- `initialize_policy(workflow_id, destination, asset_mint, max_per_run, max_total, min_interval_seconds, expires_at, keeper)` — owner signs; creates the policy PDA. The vault PDA is funded separately.
- `update_policy(...)` — owner only. Tightening is immediate; any increase requires a new user signature.
- `set_paused(bool)` — owner only. Pausing blocks all automated execution.
- `deposit_sol(amount)` — owner signs a system transfer into the vault PDA.
- `withdraw_sol(amount)` — owner only; transfers from the vault PDA back to the owner. Must preserve rent exemption.
- `withdraw_spl(amount)` — owner only; transfers from the vault ATA to the owner ATA.
- `execute_transfer_sol(amount)` — crank signs. Checks `paused`, expiry, keeper, interval, `max_per_run`, `max_total`, and destination before signing a system transfer from the vault PDA.
- `execute_transfer_spl(amount)` — same checks; CPI to the SPL Token or Token-2022 program, signed by the vault PDA.
- `record_swap_out(amount_out)` — only the configured DCA executor may call after verifying the actual output; updates counters. DCA is not part of the first deployment.

## Invariants to test

1. A non-owner cannot update the policy or withdraw.
2. A crank cannot send to any address other than `destination`.
3. `amount > max_per_run`, `total_spent + amount > max_total`, execution before
   `last_execution_at + min_interval_seconds`, expired policies, and paused
   policies all fail.
4. A failed CPI does not increment `total_spent` or `last_execution_at`.
5. SOL withdrawals cannot leave the vault below rent exemption.
6. Token-2022 transfer hooks/fees are handled with `transfer_checked` and the
   mint's decimals.
7. Revoking the keeper or pausing takes effect immediately.
8. The crank cannot use remaining accounts to substitute the destination, mint,
   token program, or vault.

## Rollout

1. Implement and test SOL transfers with LiteSVM/Anchor tests on devnet.
2. Add SPL Token and Token-2022, including ATA ownership checks.
3. Add a devnet-only UI panel; keep mainnet disabled.
4. Add Jupiter CPI only after the transfer path is audited; measure output by
   vault balance delta and enforce a user-provided `min_out`.
5. External audit before mainnet.
