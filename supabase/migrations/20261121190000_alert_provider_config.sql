-- User-configurable email providers for alert nodes.
-- API keys are stored encrypted in Supabase Vault, never in localStorage or in
-- the workflow JSON. Only the service role can reach these objects; anon and
-- authenticated are explicitly revoked because SECURITY DEFINER functions in
-- public are executable by PUBLIC unless stated otherwise.

begin;

create table if not exists public.alert_provider_config (
  owner_wallet text primary key,
  provider text not null default 'resend',
  from_email text not null default '',
  secret_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.alert_provider_config enable row level security;
revoke all on public.alert_provider_config from anon, authenticated;
grant all on public.alert_provider_config to service_role;

create or replace function public.save_alert_provider_config(
  p_owner_wallet text,
  p_provider text,
  p_api_key text,
  p_from_email text
) returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text := 'alert_' || regexp_replace(lower(coalesce(p_provider, 'resend')), '[^a-z0-9]', '_', 'g')
                 || '_' || regexp_replace(lower(trim(p_owner_wallet)), '[^a-z0-9]', '_', 'g');
  v_existing_provider text;
  v_id uuid;
begin
  if p_owner_wallet is null or length(trim(p_owner_wallet)) < 10 then
    raise exception 'owner_wallet required';
  end if;
  if p_api_key is null or length(trim(p_api_key)) < 8 then
    -- No new key: keep the existing encrypted secret and provider. This lets
    -- the user update only the sender without re-entering credentials.
    select secret_name, provider into v_name, v_existing_provider
    from public.alert_provider_config
    where owner_wallet = lower(trim(p_owner_wallet));
    if v_name is null then
      raise exception 'api_key required';
    end if;
    if coalesce(v_existing_provider, 'resend') <> coalesce(p_provider, 'resend') then
      raise exception 'changing provider requires a new api_key';
    end if;
    p_provider := v_existing_provider;
  else
    select id into v_id from vault.secrets where name = v_name;
    if v_id is null then
      perform vault.create_secret(trim(p_api_key), v_name, 'Alert provider API key');
    else
      perform vault.update_secret(v_id, trim(p_api_key), v_name, 'Alert provider API key');
    end if;
  end if;

  insert into public.alert_provider_config (owner_wallet, provider, from_email, secret_name, updated_at)
  values (
    lower(trim(p_owner_wallet)),
    coalesce(p_provider, 'resend'),
    coalesce(trim(p_from_email), ''),
    v_name,
    now()
  )
  on conflict (owner_wallet) do update
    set provider = excluded.provider,
        from_email = excluded.from_email,
        secret_name = excluded.secret_name,
        updated_at = now();
end $$;

create or replace function public.get_alert_provider_config(p_owner_wallet text)
returns table(provider text, api_key text, from_email text)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
  select c.provider, s.decrypted_secret, c.from_email
  from public.alert_provider_config c
  join vault.decrypted_secrets s on s.name = c.secret_name
  where c.owner_wallet = lower(trim(p_owner_wallet));
end $$;

create or replace function public.get_alert_provider_status(p_owner_wallet text)
returns table(provider text, from_email text, configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
  select c.provider, c.from_email, (s.id is not null), c.updated_at
  from public.alert_provider_config c
  left join vault.secrets s on s.name = c.secret_name
  where c.owner_wallet = lower(trim(p_owner_wallet));
end $$;

revoke all on function public.save_alert_provider_config(text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_alert_provider_config(text) from public, anon, authenticated;
revoke all on function public.get_alert_provider_status(text) from public, anon, authenticated;

grant execute on function public.save_alert_provider_config(text, text, text, text) to service_role;
grant execute on function public.get_alert_provider_config(text) to service_role;
grant execute on function public.get_alert_provider_status(text) to service_role;

commit;
