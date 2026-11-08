# Automation scheduler

The scheduler is split into two layers:

1. `pg_cron` runs `public.dispatch_due_workflows()` every 30 seconds.
2. That function calls the `dispatch-due-workflows` Edge Function with the
   `x-cron-secret` header. The Edge Function claims due rows atomically with
   `claim_due_workflows()` and calls `run-workflow`.

Only workflows with `automation_status = 'active'` and a non-manual
`execution_mode` are eligible. A worker lease prevents two cron invocations from
running the same workflow in parallel.

For `vault_transfer`, `run-workflow` calls the `execute-vault` Edge Function with
the stable workflow UUID, owner wallet, destination from the step, and amount in
lamports. `execute-vault` derives the policy/vault PDAs, verifies the on-chain
policy, and signs `execute_transfer_sol` with the configured crank. The program
rechecks every limit, so a compromised dispatcher still cannot exceed the
user's policy.

## Required secrets

Set these as Supabase Edge Function secrets:

- `CRON_SECRET` — shared only between the Vault-backed cron function and the
  dispatcher.
- `PINATA_JWT`, `PINATA_GROUP_ID` — workflow JSON pinning. `pin-to-ipfs`
  requires a wallet signature over `owner_wallet + workflow_id`; the old
  `signature: "skip"` bypass is rejected. `upload-user-asset` also requires a
  wallet signature over `owner_wallet + asset name + kind`.
- `VAULT_EXECUTION_ENABLED` — must be exactly `true` to allow
  `execute-vault` to sign. Keep it `false` until the vault is audited.
- `VAULT_CRANK_SECRET_KEY` — funded devnet keypair (base58 or JSON byte array)
  used only as the permissionless crank. It never controls a user vault.
- `SOLANA_RPC_URL` — devnet RPC used by `execute-vault`.
- `VAULT_PROGRAM_ID` — defaults to
  `dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA`.
- `TELEGRAM_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, `RESEND_API_KEY`,
  `ALERT_FROM_EMAIL`, and the WhatsApp provider credentials when those alert
  channels are enabled.

Store the first two values in Supabase Vault (not in source control):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');
```

`public.dispatch_due_workflows()` no-ops until both Vault secrets exist.

## Execution modes

| Mode | Automatic funds? | Current behavior |
| --- | --- | --- |
| `manual` | No | Only runs from the app. |
| `notify` | No | Cron evaluates triggers and delivers alert steps. Financial steps are skipped and logged. |
| `vault_transfer` | Yes, bounded | Cron is active and sends alerts. Fund movement remains disabled until the devnet vault is audited and `VAULT_EXECUTION_ENABLED` is explicitly enabled. |
| `vault_dca` | Yes, bounded | Cron is active, but the Jupiter CPI path is not implemented. |
| `subscription` | Yes, bounded | Cron is active, but Solana Subscriptions integration is not implemented. |

The cron never receives a user private key. A PDA vault can only move funds
through instructions that enforce the user's on-chain policy. The devnet program
is `dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA`; the browser panel derives the
policy and vault PDAs from `owner + SHA-256(workflow_id)`.

## Per-wallet IPFS space

`pin-to-ipfs` and `upload-user-asset` create a Pinata group per wallet and store
its ID in `public.user_ipfs_spaces`. Workflow JSON and non-secret assets are
pinned inside that group, and `solflows.manifest.json` (also pinned in the
group) is the stable index CID. Because Pinata limits group names to 50
characters, the group name is `solflows:<wallet-prefix>:<hash>`; the full wallet
is always the lookup key in Supabase.
