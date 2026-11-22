-- Per-node Telegram credentials for Alert nodes.
-- The bot token lives in Supabase Vault and is never returned to the browser
-- or written into the workflow JSON. Chat ID is not a secret, but it is kept
-- next to the token so the node health check can tell if it can really send.

begin;

alter table public.alert_provider_config
  add column if not exists telegram_secret_name text,
  add column if not exists telegram_chat_id text not null default '';

-- Replace any earlier signatures so a caller must always name the node.
drop function if exists public.save_alert_telegram_config(text, text, text, text);
drop function if exists public.get_alert_telegram_config(text, text);
drop function if exists public.get_alert_telegram_status(text, text);

create or replace function public.save_alert_telegram_config(
  p_owner_wallet text,
  p_node_id text,
  p_bot_token text,
  p_chat_id text
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_owner text := lower(trim(coalesce(p_owner_wallet, '')));
  v_node text := trim(coalesce(p_node_id, ''));
  v_chat text := trim(coalesce(p_chat_id, ''));
  v_name text;
  v_existing_name text;
  v_id uuid;
begin
  if length(v_owner) < 10 then
    raise exception 'owner_wallet required';
  end if;
  if v_node = '' or length(v_node) > 120 or v_node !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'node_id required';
  end if;
  if v_chat = '' or length(v_chat) > 120 or v_chat !~ '^@?[A-Za-z0-9_-]+$' then
    raise exception 'chat_id required';
  end if;

  v_name := 'alert_telegram_' || md5(v_owner || ':' || v_node);

  if p_bot_token is null or length(trim(p_bot_token)) < 10 then
    -- Keep the existing token when the user only changes the chat ID.
    select telegram_secret_name into v_existing_name
    from public.alert_provider_config
    where owner_wallet = v_owner and node_id = v_node;
    if v_existing_name is null or trim(v_existing_name) = '' then
      raise exception 'bot_token required';
    end if;
    v_name := v_existing_name;
  else
    select id into v_id from vault.secrets where name = v_name;
    if v_id is null then
      perform vault.create_secret(trim(p_bot_token), v_name, 'Alert node Telegram bot token');
    else
      perform vault.update_secret(v_id, trim(p_bot_token), v_name, 'Alert node Telegram bot token');
    end if;
  end if;

  insert into public.alert_provider_config (
    owner_wallet, node_id, provider, from_email, secret_name,
    telegram_secret_name, telegram_chat_id, updated_at
  )
  values (v_owner, v_node, 'resend', '', '', v_name, v_chat, now())
  on conflict (owner_wallet, node_id) do update
    set telegram_secret_name = excluded.telegram_secret_name,
        telegram_chat_id = excluded.telegram_chat_id,
        updated_at = now();
end $$;

create or replace function public.get_alert_telegram_config(
  p_owner_wallet text,
  p_node_id text
)
returns table(bot_token text, chat_id text)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
  select s.decrypted_secret, c.telegram_chat_id
  from public.alert_provider_config c
  join vault.decrypted_secrets s on s.name = c.telegram_secret_name
  where c.owner_wallet = lower(trim(p_owner_wallet))
    and c.node_id = trim(p_node_id)
    and c.telegram_secret_name is not null
    and trim(c.telegram_secret_name) <> '';
end $$;

create or replace function public.get_alert_telegram_status(
  p_owner_wallet text,
  p_node_id text
)
returns table(chat_id text, configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
  select c.telegram_chat_id, (s.id is not null), c.updated_at
  from public.alert_provider_config c
  left join vault.secrets s on s.name = c.telegram_secret_name
  where c.owner_wallet = lower(trim(p_owner_wallet))
    and c.node_id = trim(p_node_id)
    and c.telegram_secret_name is not null
    and trim(c.telegram_secret_name) <> '';
end $$;

revoke all on function public.save_alert_telegram_config(text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_alert_telegram_config(text, text) from public, anon, authenticated;
revoke all on function public.get_alert_telegram_status(text, text) from public, anon, authenticated;

grant execute on function public.save_alert_telegram_config(text, text, text, text) to service_role;
grant execute on function public.get_alert_telegram_config(text, text) to service_role;
grant execute on function public.get_alert_telegram_status(text, text) to service_role;

commit;
