-- Supabase > SQL Editor mein poora paste karke Run karo
create extension if not exists pgcrypto;

create table anime (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  genre text not null default 'Action',
  description text not null default '',
  poster_url text not null default '',
  created_at timestamptz not null default now()
);

create table episodes (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references anime(id) on delete cascade,
  number int not null default 1,
  title text not null,
  created_at timestamptz not null default now()
);

create table shortener_tokens (
  token text primary key,
  user_id uuid not null,
  episode_id uuid not null references episodes(id) on delete cascade,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index on shortener_tokens (user_id, created_at);

create table access_grants (
  user_id uuid not null,
  episode_id uuid not null references episodes(id) on delete cascade,
  expires_at timestamptz not null,
  primary key (user_id, episode_id)
);

-- RLS on, koi policy nahi: tables sirf server (service role key) se khulte hain
alter table anime enable row level security;
alter table episodes enable row level security;
alter table shortener_tokens enable row level security;
alter table access_grants enable row level security;

-- Naye features (update1.sql ke same)
create table if not exists settings (key text primary key, value text not null default '');
create table if not exists reports (id uuid primary key default gen_random_uuid(), user_id uuid not null, episode_id uuid not null references episodes(id) on delete cascade, message text not null default '', resolved boolean not null default false, created_at timestamptz not null default now());
alter table settings enable row level security;
alter table reports enable row level security;
