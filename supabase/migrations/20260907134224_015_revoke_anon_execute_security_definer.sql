-- Revoke EXECUTE on all SECURITY DEFINER functions from anon role
-- These functions should only be callable by authenticated users

-- Order management functions
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) FROM anon;

-- Auth/helper functions  
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM anon;

-- Checkout function - only authenticated users can place orders
REVOKE EXECUTE ON FUNCTION public.place_order FROM anon;

-- Also revoke from authenticated for functions that should be staff-only
-- is_staff() is used in RLS policies but should not be directly callable
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM authenticated;

-- log_owner_action should only be called from within server functions, not directly
REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM authenticated;

-- update_order_status and verify_payment should only be callable by staff
-- Keep EXECUTE on authenticated (RLS/is_staff() inside the function gates access)
-- but ensure anon cannot call them at all
