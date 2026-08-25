-- S02: private Storage bucket for source blobs.
-- Path canonical form: {owner_id}/{source_id}/{object_name}
-- First path segment MUST equal auth.uid() (JWT sub).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sources',
  'sources',
  false,
  52428800, -- 50 MiB (covers P0 pdf/epub/docx/image/video samples)
  array[
    'text/plain',
    'text/markdown',
    'text/html',
    'application/pdf',
    'application/epub+zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: first folder segment of object name
create or replace function public.storage_owner_prefix(object_name text)
returns text
language sql
immutable
as $$
  select split_part(object_name, '/', 1);
$$;

drop policy if exists "sources_storage_select_own" on storage.objects;
drop policy if exists "sources_storage_insert_own" on storage.objects;
drop policy if exists "sources_storage_update_own" on storage.objects;
drop policy if exists "sources_storage_delete_own" on storage.objects;

create policy "sources_storage_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sources'
    and public.storage_owner_prefix(name) = (select auth.uid()::text)
  );

create policy "sources_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sources'
    and public.storage_owner_prefix(name) = (select auth.uid()::text)
  );

create policy "sources_storage_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'sources'
    and public.storage_owner_prefix(name) = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'sources'
    and public.storage_owner_prefix(name) = (select auth.uid()::text)
  );

create policy "sources_storage_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'sources'
    and public.storage_owner_prefix(name) = (select auth.uid()::text)
  );
