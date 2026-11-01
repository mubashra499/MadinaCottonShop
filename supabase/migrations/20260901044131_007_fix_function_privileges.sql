/*
# Fix function EXECUTE privileges

PostgreSQL grants EXECUTE to PUBLIC by default on all functions.
REVOKE FROM anon doesn't work because anon inherits from PUBLIC.
Must REVOKE FROM PUBLIC, then GRANT only to the roles that need it.

- is_staff(): needed by authenticated (for RLS policy checks)
- handle_new_user_profile(): trigger function, only needs to run as the owner — no direct RPC access needed
- log_owner_action(): needed by authenticated (owner calls it from admin panel)
*/

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) TO authenticated;
