-- Episode view counter (run once in Supabase SQL editor)
alter table episodes add column if not exists views bigint not null default 0;
