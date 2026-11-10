-- Persistent in-app notifications.
--
-- The cron runs `run-workflow` with the service role and writes one row per
-- `send_alert` step with channel `app`. The browser reads its own wallet rows,
-- marks them as read and clears them. Inserts stay service-role only so a
-- client cannot forge notifications for another wallet.
begin;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null,
  workflow_id text,
  workflow_name text,
  title text not null default 'Notificación',
  message text not null,
  channel text not null default 'app',
  status text not null default 'info',
  read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_owner_created_idx
  on public.user_notifications (owner_wallet, created_at desc);

create index if not exists user_notifications_owner_unread_idx
  on public.user_notifications (owner_wallet)
  where read = false;

alter table public.user_notifications enable row level security;

drop policy if exists "Public can read notifications" on public.user_notifications;
create policy "Public can read notifications" on public.user_notifications
  for select to anon, authenticated
  using (true);

drop policy if exists "Public can update notifications" on public.user_notifications;
create policy "Public can update notifications" on public.user_notifications
  for update to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public can delete notifications" on public.user_notifications;
create policy "Public can delete notifications" on public.user_notifications
  for delete to anon, authenticated
  using (true);

revoke all on public.user_notifications from anon, authenticated;
grant select, update, delete on public.user_notifications to anon, authenticated;
grant all on public.user_notifications to service_role;

commit;
