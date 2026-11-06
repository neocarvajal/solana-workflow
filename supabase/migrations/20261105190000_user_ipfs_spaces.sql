-- A per-wallet Pinata group acts as the user's IPFS folder. The manifest file
-- inside the group is the stable index; workflow CIDs are immutable themselves.
create table if not exists public.user_ipfs_spaces (
  owner_wallet text primary key,
  group_id text not null,
  manifest_cid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_assets (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null,
  kind text not null default 'asset',
  name text not null,
  mime_type text,
  cid text not null,
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_wallet, cid)
);

create index if not exists user_assets_owner_idx
  on public.user_assets (owner_wallet, created_at desc);

alter table public.user_ipfs_spaces enable row level security;
alter table public.user_assets enable row level security;

revoke all on public.user_ipfs_spaces from anon, authenticated;
revoke all on public.user_assets from anon, authenticated;
grant all on public.user_ipfs_spaces to service_role;
grant all on public.user_assets to service_role;
