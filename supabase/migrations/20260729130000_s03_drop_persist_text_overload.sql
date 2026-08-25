-- S03 reopen: remove text overload that breaks PostgREST function resolution (PGRST203).
-- Keep only the uuid signature for p_source_request_id.

drop function if exists public.persist_pasted_text_source(
  uuid, uuid, text, text, text, text, jsonb
);
