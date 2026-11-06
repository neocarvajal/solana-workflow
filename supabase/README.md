# Automation scheduler

The scheduler is split into two layers:

1. `pg_cron` runs `public.dispatch_due_workflows()` every 30 seconds.
2. That function calls the `dispatch-due-workflows` Edge Function with the
   `x-cron-secret` header. The Edge Function claims due rows atomically with
   `claim_due_workflows()` and calls `run-workflow`.

Only workflows with `automation_status = 'active'` and a non-manual
`execution_mode` are eligible. A worker lease prevents two cron invocations from
running the same workflow in parallel.

## Required secrets

Set these as Supabase Edge Function secrets:

- `CRON_SECRET` — shared only between the Vault-backed cron function and the
  dispatcher.
- `PINATA_JWT`, `PINATA_GROUP_ID` — workflow JSON pinning.
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
| `notify` | No | Cron evaluates triggers and delivers alert steps. Financial steps are logged as requiring a user signature. |
| `vault_transfer` | Yes, bounded | Saved but inactive until the vault program is deployed and a policy is registered. |
| `vault_dca` | Yes, bounded | Saved but inactive until the vault program and Jupiter CPI path are implemented. |
| `subscription` | Yes, bounded | Reserved for Solana Subscriptions integration. |

The cron never receives a user private key. A PDA vault can only move funds
through instructions that enforce the user's on-chain policy.

## Per-wallet IPFS space

`pin-to-ipfs` and `upload-user-asset` create a Pinata group per wallet and store
its ID in `public.user_ipfs_spaces`. Workflow JSON and non-secret assets are
pinned inside that group, and `solflows.manifest.json` (also pinned in the
group) is the stable index CID. Because Pinata limits group names to 50
characters, the group name is `solflows:<wallet-prefix>:<hash>`; the full wallet
is always the lookup key in Supabase.
