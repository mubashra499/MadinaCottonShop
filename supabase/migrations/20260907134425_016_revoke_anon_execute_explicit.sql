-- Ensure anon role cannot execute staff-only SECURITY DEFINER functions
-- These functions have internal is_staff() checks, but anon should not reach them at all

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) FROM PUBLIC, anon;

-- place_order is intentionally callable by authenticated customers
-- but should not be callable by anon
REVOKE EXECUTE ON FUNCTION public.place_order FROM PUBLIC, anon;
