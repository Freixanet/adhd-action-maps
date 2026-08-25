-- S02 fix: table privileges for authenticated (RLS still enforces row ownership).
-- Without GRANT, PostgREST returns permission denied before RLS runs.

grant select, insert, update, delete on table public.sources to authenticated;
grant select, insert, update, delete on table public.source_versions to authenticated;
grant select, insert, update, delete on table public.source_segments to authenticated;

-- maps already used by the app; ensure privileges exist for authenticated.
grant select, insert, update, delete on table public.maps to authenticated;

-- usage_daily: no client access
revoke all on table public.usage_daily from authenticated;
revoke all on table public.usage_daily from anon;

revoke all on table public.sources from anon;
revoke all on table public.source_versions from anon;
revoke all on table public.source_segments from anon;
revoke all on table public.maps from anon;
