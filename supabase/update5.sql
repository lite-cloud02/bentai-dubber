-- Episode thumbnail (16:9). Supabase SQL Editor mein ek baar Run karo (dobara chalane se koi nuksan nahi)
alter table episodes add column if not exists thumb_url text not null default '';
