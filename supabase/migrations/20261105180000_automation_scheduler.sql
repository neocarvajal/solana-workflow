-- Automation scheduler, execution modes and fund-policy tables.
-- The cron claims every explicitly active non-manual workflow. `run-workflow`
-- still decides whether a financial step is allowed to sign; on-chain vault
-- policy checks are the security boundary.

begin;

alter table public.workflows
  add column if not exists workflow_id text,
  add column if not exists execution_mode text not null default 'notify',
  add column if not exists schedule_seconds integer not null default 900,
  add column if not exists automation_status text not null default 'inactive',
  add column if not exists next_run_at timestamptz,
  add column if not exists last_run_at timestamptz,
  add column if not exists last_error text,
  add column if not exists failure_count integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists claimed_by text,
  add column if not exists vault_address text,
  add column if not exists vault_authority text,
  add column if not exists policy_address text,
  add column if not exists onchain_account text,
  add column if not exists workflow_hash text;

-- Backfill an identity for rows created before workflow_id existed.
update public.workflows
set workflow_id = gen_random_uuid()::text
where workflow_id is null or workflow_id = '';

update public.workflows
set execution_mode = 'manual'
where schedule = 'manual';

update public.workflows
set schedule_seconds = case schedule
  when '30s' then 30
  when '1m' then 60
  when '2m' then 120
  when '5m' then 300
  when '15m' then 900
  when '30m' then 1800
  when '1h' then 3600
  when '6h' then 21600
  when '24h' then 86400
  else 0
end
where schedule_seconds = 900;

create unique index if not exists workflows_owner_workflow_id_uidx
  on public.workflows (owner_wallet, workflow_id)
  where workflow_id is not null;

create index if not exists workflows_due_idx
  on public.workflows (next_run_at)
  where enabled and automation_status = 'active';

alter table public.workflow_runs
  add column if not exists scheduled_for timestamptz,
  add column if not exists execution_mode text,
  add column if not exists tx_signature text,
  add column if not exists amount_in numeric,
  add column if not exists amount_out numeric,
  add column if not exists error text;

create unique index if not exists workflow_runs_schedule_uidx
  on public.workflow_runs (workflow_id, scheduled_for)
  where scheduled_for is not null;

-- One vault/policy per workflow. The actual authority is a PDA owned by the
-- vault program; this table is the index used by the app and the dispatcher.
create table if not exists public.user_vaults (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null,
  workflow_id text not null,
  vault_address text not null,
  vault_authority text,
  policy_address text,
  execution_mode text not null default 'vault_transfer',
  input_mint text,
  output_mint text,
  destination text,
  max_per_run numeric,
  max_total numeric,
  min_interval_seconds integer,
  expires_at timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_wallet, workflow_id)
);

create table if not exists public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null,
  tx_signature text,
  amount_in numeric,
  amount_out numeric,
  error text,
  logs jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workflow_id, scheduled_for)
);

create index if not exists workflow_executions_workflow_idx
  on public.workflow_executions (workflow_id, scheduled_for desc);

-- Claim due rows atomically. The lease prevents two cron invocations from
-- executing the same workflow at the same time.
create or replace function public.claim_due_workflows(
  p_limit integer default 10,
  p_worker text default 'supabase-cron'
)
returns table (
  id uuid,
  workflow_id text,
  owner_wallet text,
  name text,
  workflow_json jsonb,
  schedule text,
  execution_mode text,
  schedule_seconds integer,
  scheduled_for timestamptz,
  next_run_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select w.id, w.next_run_at as scheduled_for
    from public.workflows w
    where w.enabled
      and w.execution_mode <> 'manual'
      and w.automation_status = 'active'
      and w.schedule <> 'manual'
      and w.next_run_at is not null
      and w.next_run_at <= now()
      and (w.lease_until is null or w.lease_until < now())
    order by w.next_run_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 100))
    for update skip locked
  )
  update public.workflows w
  set lease_until = now() + interval '5 minutes',
      claimed_by = p_worker,
      last_error = null,
      next_run_at = now() + make_interval(
        secs => greatest(
          case when w.schedule_seconds > 0 then w.schedule_seconds else 900 end,
          30
        )
      )
  from due
  where w.id = due.id
  returning
    w.id,
    w.workflow_id,
    w.owner_wallet,
    w.name,
    w.json as workflow_json,
    w.schedule,
    w.execution_mode,
    w.schedule_seconds,
    due.scheduled_for,
    w.next_run_at;
end;
$$;

create or replace function public.finish_workflow_run(
  p_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workflows
  set lease_until = null,
      claimed_by = null,
      last_run_at = now(),
      last_error = p_error,
      failure_count = case when p_status = 'failed' then failure_count + 1 else 0 end,
      automation_status = case
        when p_status = 'failed' and failure_count + 1 >= 5 then 'paused'
        else automation_status
      end,
      updated_at = now()
  where id = p_id;
end;
$$;

-- The scheduler is server-only. Vault rows and execution history are not
-- readable with the public anon key.
alter table public.user_vaults enable row level security;
alter table public.workflow_executions enable row level security;

revoke all on public.user_vaults from anon, authenticated;
revoke all on public.workflow_executions from anon, authenticated;
grant all on public.user_vaults to service_role;
grant all on public.workflow_executions to service_role;
revoke all on function public.claim_due_workflows(integer, text) from public, anon, authenticated;
revoke all on function public.finish_workflow_run(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_due_workflows(integer, text) to service_role;
grant execute on function public.finish_workflow_run(uuid, text, text) to service_role;

-- Supabase Cron calls the dispatcher Edge Function. The two Vault secrets are
-- intentionally provisioned outside this migration:
--   project_url  = https://<project-ref>.supabase.co
--   cron_secret  = same value as the CRON_SECRET Edge Function secret
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_due_workflows()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  cron_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/dispatch-due-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.dispatch_due_workflows() from public, anon, authenticated;
grant execute on function public.dispatch_due_workflows() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'dispatch-due-workflows') then
    perform cron.unschedule('dispatch-due-workflows');
  end if;
  perform cron.schedule(
    'dispatch-due-workflows',
    '30 seconds',
    'select public.dispatch_due_workflows();'
  );
end;
$$;

commit;
