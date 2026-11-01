/*
# Security: Revoke EXECUTE on SECURITY DEFINER functions

## Summary
The security advisor flagged 5 issues with SECURITY DEFINER functions being callable by anon/authenticated roles.

## Changes
1. Revoke EXECUTE on place_order from anon (must be authenticated to place orders)
2. Revoke EXECUTE on handle_new_user_profile from anon and authenticated (trigger only, never called via API)
3. Revoke EXECUTE on log_owner_action from anon (must be authenticated + staff check inside function)
4. Keep is_staff() executable by authenticated (needed for RLS policy checks — it's a read-only boolean check)
*/

-- place_order: only authenticated users can place orders
REVOKE EXECUTE ON FUNCTION public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text
) FROM anon;

-- handle_new_user_profile: trigger function, never called via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM authenticated;

-- log_owner_action: only authenticated (function internally checks is_staff)
REVOKE EXECUTE ON FUNCTION public.log_owner_action(
  text, text, text, jsonb, jsonb
) FROM anon;

-- is_staff: keep executable by authenticated (needed for RLS policies)
-- This is a read-only boolean function that checks the caller's own role — safe
