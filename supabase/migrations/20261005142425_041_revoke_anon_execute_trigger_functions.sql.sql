-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon and authenticated
-- These are trigger functions (set_verified_purchase, update_product_rating) and should
-- never be called directly via RPC. Revoking EXECUTE closes the advisor warning.

REVOKE EXECUTE ON FUNCTION public.set_verified_purchase() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_rating() FROM anon, authenticated;
