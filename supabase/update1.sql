-- Supabase > SQL Editor mein paste karke Run karo (naye features ke liye)
create table if not exists settings (
  key text primary key,
  value text not null default ''
);
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  episode_id uuid not null references episodes(id) on delete cascade,
  message text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reports_open on reports (resolved, created_at);
alter table settings enable row level security;
alter table reports enable row level security;
