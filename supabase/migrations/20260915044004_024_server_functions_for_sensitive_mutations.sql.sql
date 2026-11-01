/*
# Server-side functions for sensitive mutations that were previously direct client writes

## New functions:
1. update_custom_order_status — owner-only, validates transitions
2. update_production_status — owner-only, validates transitions  
3. moderate_review — owner-only, sets approved flag or deletes
4. send_owner_message — owner-only, sets sender='owner' server-side
5. approve_return — owner-only, atomically approves return + optionally triggers refund

## Column-level privilege restrictions on sensitive columns
*/

-- ============================================================
-- 1. update_custom_order_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_custom_order_status(
  p_custom_order_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  SELECT status INTO v_current FROM custom_orders WHERE id = p_custom_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Custom order not found'; END IF;

  IF NOT (
    (v_current = 'pending' AND p_new_status IN ('reviewing','rejected','cancelled')) OR
    (v_current = 'reviewing' AND p_new_status IN ('quoted','rejected','cancelled')) OR
    (v_current = 'quoted' AND p_new_status IN ('accepted','rejected','cancelled')) OR
    (v_current = 'accepted' AND p_new_status IN ('in_production','cancelled')) OR
    (v_current = 'in_production' AND p_new_status IN ('completed','cancelled')) OR
    (v_current = 'completed' AND p_new_status = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Invalid transition from % to %', v_current, p_new_status;
  END IF;

  UPDATE custom_orders SET status = p_new_status, updated_at = now() WHERE id = p_custom_order_id;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (v_user_id, 'CUSTOM_ORDER_STATUS', 'custom_orders', p_custom_order_id,
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_new_status, 'notes', p_notes));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_custom_order_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_custom_order_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_custom_order_status(uuid, text, text) TO authenticated;

-- ============================================================
-- 2. update_production_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_production_status(
  p_production_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  SELECT status INTO v_current FROM production_orders WHERE id = p_production_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production order not found'; END IF;

  IF p_new_status NOT IN ('material_check','cutting','stitching','finishing','quality_check','packing','completed','on_hold') THEN
    RAISE EXCEPTION 'Invalid production status: %', p_new_status;
  END IF;

  UPDATE production_orders SET status = p_new_status, updated_at = now(), notes = COALESCE(p_notes, notes) WHERE id = p_production_id;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (v_user_id, 'PRODUCTION_STATUS', 'production_orders', p_production_id,
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_new_status, 'notes', p_notes));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_production_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_production_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_production_status(uuid, text, text) TO authenticated;

-- ============================================================
-- 3. moderate_review
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_review(
  p_review_id uuid,
  p_approve boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized to moderate reviews';
  END IF;

  v_user_id := auth.uid();

  IF p_approve THEN
    UPDATE reviews SET approved = true WHERE id = p_review_id;
  ELSE
    DELETE FROM reviews WHERE id = p_review_id;
  END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, new_value)
  VALUES (v_user_id, 'REVIEW_MODERATION', 'reviews', p_review_id,
    jsonb_build_object('approved', p_approve));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.moderate_review(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderate_review(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_review(uuid, boolean) TO authenticated;

-- ============================================================
-- 4. send_owner_message
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_owner_message(
  p_customer_id uuid,
  p_body text,
  p_order_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized to send owner messages';
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Message body cannot be empty';
  END IF;

  INSERT INTO messages (user_id, sender, body, order_id, product_id)
  VALUES (p_customer_id, 'owner', trim(p_body), p_order_id, p_product_id);

  INSERT INTO notifications (user_id, type, title, body, read)
  VALUES (p_customer_id, 'message', 'New message from Madina Cotton', p_body, false);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.send_owner_message(uuid, text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_owner_message(uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_owner_message(uuid, text, uuid, uuid) TO authenticated;

-- ============================================================
-- 5. approve_return
--    Atomically approves the return and optionally processes refund
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_return(
  p_return_id uuid,
  p_refund_amount numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_return record;
  v_refund_result jsonb;
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  SELECT * INTO v_return FROM returns WHERE id = p_return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return request not found'; END IF;

  IF v_return.status != 'pending' THEN
    RAISE EXCEPTION 'Return is not pending (current: %)', v_return.status;
  END IF;

  UPDATE returns SET status = 'approved' WHERE id = p_return_id;

  IF v_return.order_id IS NOT NULL THEN
    SELECT process_refund(v_return.order_id, p_refund_amount, COALESCE(p_reason, 'Return approved')) INTO v_refund_result;
  END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, new_value)
  VALUES (v_user_id, 'RETURN_APPROVED', 'returns', p_return_id,
    jsonb_build_object('refund_result', v_refund_result));

  RETURN jsonb_build_object('success', true, 'refund', v_refund_result);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.approve_return(uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_return(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_return(uuid, numeric, text) TO authenticated;

-- ============================================================
-- 6. reject_return
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_return(
  p_return_id uuid,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  UPDATE returns SET status = 'rejected' WHERE id = p_return_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'Return not found or not pending'; END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, new_value)
  VALUES (v_user_id, 'RETURN_REJECTED', 'returns', p_return_id,
    jsonb_build_object('reason', p_reason));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.reject_return(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_return(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_return(uuid, text) TO authenticated;

-- ============================================================
-- Column-level privilege restrictions
-- ============================================================

-- coupons.usage_count: only incremented by place_order (SECURITY DEFINER)
REVOKE UPDATE (usage_count) ON public.coupons FROM authenticated, anon;

-- reviews.approved: only set by moderate_review (SECURITY DEFINER)
REVOKE UPDATE (approved) ON public.reviews FROM authenticated, anon;

-- custom_orders.status: only set by update_custom_order_status
REVOKE UPDATE (status) ON public.custom_orders FROM authenticated, anon;

-- production_orders.status: only set by update_production_status
REVOKE UPDATE (status) ON public.production_orders FROM authenticated, anon;

-- messages.sender: only set by send_owner_message or RLS insert with sender='customer'
REVOKE INSERT (sender) ON public.messages FROM authenticated, anon;
REVOKE UPDATE (sender) ON public.messages FROM authenticated, anon;

-- returns.status: only set by approve_return / reject_return
REVOKE UPDATE (status) ON public.returns FROM authenticated, anon;

-- order_change_requests.status: only set server-side
REVOKE UPDATE (status) ON public.order_change_requests FROM authenticated, anon;
