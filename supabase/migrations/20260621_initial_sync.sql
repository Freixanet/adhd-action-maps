-- Run this migration in a Supabase staging project first. It is additive and
-- does not touch the existing web application's localStorage data.
create table if not exists public.maps (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text,
  pinned_at timestamptz,
  source_type text not null check (source_type in ('text', 'link', 'youtube', 'file', 'pdf')),
  session jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maps_owner_updated_idx on public.maps (owner_id, updated_at desc);

alter table public.maps enable row level security;

-- Idempotent: remote may already have these policies from a manual/bootstrap apply
-- without supabase_migrations history.
drop policy if exists "maps are readable by their owner" on public.maps;
drop policy if exists "maps are insertable by their owner" on public.maps;
drop policy if exists "maps are updatable by their owner" on public.maps;
drop policy if exists "maps are deletable by their owner" on public.maps;

create policy "maps are readable by their owner"
  on public.maps for select to authenticated using ((select auth.uid()) = owner_id);
create policy "maps are insertable by their owner"
  on public.maps for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "maps are updatable by their owner"
  on public.maps for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "maps are deletable by their owner"
  on public.maps for delete to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_maps_updated_at on public.maps;
create trigger set_maps_updated_at before update on public.maps
for each row execute procedure public.set_updated_at();
