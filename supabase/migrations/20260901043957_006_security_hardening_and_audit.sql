/*
# Security Hardening + Audit Log Helper

1. Security Fixes
   - Revoke EXECUTE on `is_staff()` from `anon` — it's a SECURITY DEFINER function that should only be callable by authenticated users. The advisor flagged it as publicly callable.
   - Revoke EXECUTE on `handle_new_user_profile()` from `anon` — it's a SECURITY DEFINER trigger function that should not be directly callable. (It's a trigger, so it still fires automatically; we just close the direct RPC path.)
   - Set explicit search_path on `is_staff()` to prevent search_path injection.

2. New Function
   - `log_owner_action(p_action, p_entity, p_entity_id, p_old_value, p_new_value)` — SECURITY DEFINER function that inserts into `audit_logs` using the caller's auth.uid(). Only callable by authenticated users (EXECUTE revoked from anon). This lets the frontend log admin actions without needing direct INSERT privileges on audit_logs.

3. Notes
   - All changes are additive or privilege-narrowing — no data is lost.
   - `is_staff()` remains callable by `authenticated` because RLS policies throughout the schema depend on it.
*/

-- Fix 1: Harden is_staff() with explicit search_path
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'myousufshaikh399@gmail.com'
  );
$$;

-- Revoke EXECUTE from anon on both SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;

-- Grant EXECUTE to authenticated (they need it for RLS policy checks)
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Fix 2: Audit log helper function
CREATE OR REPLACE FUNCTION public.log_owner_action(
  p_action text,
  p_entity text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (auth.uid(), p_action, p_entity, p_entity_id, p_old_value, p_new_value);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) TO authenticated;
