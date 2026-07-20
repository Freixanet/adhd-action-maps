-- Daily usage counters for free/pro metering (optional durable store).
-- Server currently meters in-memory; this table is ready for a later Postgres-backed meter.

create table if not exists public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  transform_count integer not null default 0,
  chat_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.usage_daily enable row level security;

-- No direct client access; service role / server only.
drop policy if exists "usage_daily_no_client" on public.usage_daily;
create policy "usage_daily_no_client"
  on public.usage_daily
  for all
  to authenticated
  using (false)
  with check (false);
