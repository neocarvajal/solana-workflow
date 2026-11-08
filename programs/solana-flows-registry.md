# solana-flows-registry (Anchor program)

## Account layout

PDA seeds: `[b"wf", owner.key().as_ref(), slug.as_bytes()]`

| Field             | Type    | Notes                          |
| ----------------- | ------- | ------------------------------ |
| owner             | Pubkey  | wallet that created it         |
| slug              | String  | max 32                         |
| name              | String  | max 64                         |
| cid               | String  | IPFS CID, max 64               |
| version           | u32     | bump on each update            |
| enabled           | bool    | active flag                    |
| updated_at        | i64     | unix seconds                   |

## Instructions

- `create_workflow(slug, name, cid)` — init PDA, version = 1.
- `update_workflow(cid)` — owner only, version += 1.
- `set_enabled(enabled)` — owner only.
- `delete_workflow()` — close PDA, refund rent to owner.

```
