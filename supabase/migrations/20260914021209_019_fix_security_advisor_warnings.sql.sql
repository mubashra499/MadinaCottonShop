/* Fix security advisor warnings */

-- 1. Fix validate_order_transition: add fixed search_path
CREATE OR REPLACE FUNCTION public.validate_order_transition(
  p_current text,
  p_new text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
SELECT CASE
  WHEN p_current = p_new THEN true
  WHEN p_current = 'new' AND p_new IN ('confirmed', 'cancelled', 'payment_pending') THEN true
  WHEN p_current = 'payment_pending' AND p_new IN ('payment_verified', 'confirmed', 'cancelled', 'failed') THEN true
  WHEN p_current = 'payment_verified' AND p_new IN ('confirmed', 'cancelled') THEN true
  WHEN p_current = 'confirmed' AND p_new IN ('production', 'stitching', 'cancelled') THEN true
  WHEN p_current = 'production' AND p_new IN ('stitching', 'finishing', 'cancelled') THEN true
  WHEN p_current = 'stitching' AND p_new IN ('finishing', 'quality_check', 'cancelled') THEN true
  WHEN p_current = 'finishing' AND p_new IN ('quality_check', 'cancelled') THEN true
  WHEN p_current = 'quality_check' AND p_new IN ('packed', 'ready', 'cancelled') THEN true
  WHEN p_current = 'packed' AND p_new IN ('shipped', 'ready') THEN true
  WHEN p_current = 'ready' AND p_new IN ('shipped', 'packed') THEN true
  WHEN p_current = 'shipped' AND p_new IN ('out_for_delivery', 'delivered', 'returned') THEN true
  WHEN p_current = 'out_for_delivery' AND p_new IN ('delivered', 'shipped', 'returned') THEN true
  WHEN p_current = 'delivered' AND p_new IN ('returned', 'refunded') THEN true
  WHEN p_current = 'returned' AND p_new IN ('refunded') THEN true
  WHEN p_current = 'cancelled' AND p_new IN ('refunded') THEN true
  ELSE false
END;
$function$;

-- 2. Revoke anon execute on is_owner and is_staff
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;

-- 3. Revoke anon execute on handle_new_user_profile (only used by trigger)
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;

-- 4. Revoke anon execute on log_owner_action
REVOKE EXECUTE ON FUNCTION public.log_owner_action(text, text, text, jsonb, jsonb) FROM anon;

-- 5. Revoke anon execute on validate_order_transition
REVOKE EXECUTE ON FUNCTION public.validate_order_transition(text, text) FROM anon;

-- 6. Revoke anon execute on update_order_status
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;

-- 7. Revoke anon execute on verify_payment if it exists
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text) FROM anon;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 8. Revoke anon execute on place_order if it exists
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, numeric, boolean, text, text) FROM anon;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
