-- Security update: devices (max 2), ek time par 1 device, rate limit
-- Supabase SQL Editor mein poora ek saath paste karke Run karo (dobara chalane se koi nuksan nahi)

create table if not exists user_devices (
  user_id uuid not null,
  email text not null default '',
  device_id text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);
alter table user_devices enable row level security;
create index if not exists user_devices_email_idx on user_devices (email);

create table if not exists play_sessions (
  user_id uuid primary key,
  device_id text not null,
  episode_id uuid,
  last_beat timestamptz not null default now()
);
alter table play_sessions enable row level security;

create table if not exists rate_limits (
  key text primary key,
  count int not null default 0,
  expires_at timestamptz not null
);
alter table rate_limits enable row level security;

create or replace function rl_hit(p_key text, p_seconds int) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into rate_limits(key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_seconds))
  on conflict (key) do update set
    count = case when rate_limits.expires_at < now() then 1 else rate_limits.count + 1 end,
    expires_at = case when rate_limits.expires_at < now() then now() + make_interval(secs => p_seconds) else rate_limits.expires_at end
  returning count into c;
  return c;
end
$$;
revoke all on function rl_hit(text, int) from public, anon, authenticated;
grant execute on function rl_hit(text, int) to service_role;
