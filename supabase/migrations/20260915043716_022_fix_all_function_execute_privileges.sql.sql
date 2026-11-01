/*
# Fix remaining SECURITY DEFINER function EXECUTE privileges

The security advisor found that several SECURITY DEFINER functions
are still callable by anon and/or authenticated roles. This migration
explicitly revokes all unnecessary EXECUTE grants.

## Functions to fix:
1. enforce_order_status_transition() — trigger function, should NOT be callable by ANYONE
2. place_order(...) — should be authenticated only (not anon)
3. process_refund(...) — should be authenticated only (not anon)
4. is_owner() — helper for RLS, authenticated only is OK (not anon)
5. is_staff() — helper for RLS, authenticated only is OK (not anon)
6. update_order_status(...) — authenticated only (internal is_owner check provides security)
7. verify_payment(...) — authenticated only (internal is_owner check provides security)
*/

-- 1. Trigger function: REVOKE from everyone (triggers fire as definer, don't need EXECUTE grants)
REVOKE EXECUTE ON FUNCTION public.enforce_order_status_transition() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_order_status_transition() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_order_status_transition() FROM PUBLIC;

-- 2. place_order: REVOKE from anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text, text
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text, text
) TO authenticated;

-- 3. process_refund: REVOKE from anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) TO authenticated;

-- 4. is_owner: REVOKE from anon (authenticated needs it for RLS policy checks)
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- 5. is_staff: REVOKE from anon
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- 6. update_order_status: REVOKE from anon (already done but reassert)
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- 7. verify_payment: REVOKE from anon (the fix from migration 021 may not have stuck)
REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) TO authenticated;

-- 8. validate_order_transition: REVOKE from anon (pure function but no need for anon access)
REVOKE EXECUTE ON FUNCTION public.validate_order_transition(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_order_transition(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_order_transition(text, text) TO authenticated;

-- 9. log_owner_action: REVOKE from anon
REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) TO authenticated;

-- 10. handle_new_user_profile: REVOKE from anon (trigger function)
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
