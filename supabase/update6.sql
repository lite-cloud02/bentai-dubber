-- Games / Apps section. Supabase SQL Editor mein poora ek saath Run karo (dobara chalane se koi nuksan nahi)

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  thumb_url text not null default '',
  shots text[] not null default '{}',
  download_url text not null default '',
  created_at timestamptz not null default now()
);
alter table games enable row level security;

create table if not exists game_grants (
  user_id uuid not null,
  game_id uuid not null references games(id) on delete cascade,
  expires_at timestamptz not null,
  primary key (user_id, game_id)
);
alter table game_grants enable row level security;

-- shortener token ab episode ya game, dono ke liye chalega
alter table shortener_tokens add column if not exists game_id uuid references games(id) on delete cascade;
alter table shortener_tokens alter column episode_id drop not null;
