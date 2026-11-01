-- Drop the old orphaned place_order function (22 params, without p_idempotency_key)
-- The new version (23 params) is in migration 020 and is the one the frontend calls.
-- PostgreSQL treats functions with different argument lists as distinct, so
-- both existed simultaneously. This removes the old one.

DROP FUNCTION IF EXISTS public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text
) CASCADE;
