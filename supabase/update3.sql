-- VIP accounts (Supabase SQL editor mein ek baar Run karo; dobara chalane se koi nuksan nahi)
create table if not exists vip_users (
  email text primary key,
  note text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table vip_users add column if not exists expires_at timestamptz; -- khali = lifetime VIP
alter table vip_users enable row level security;
