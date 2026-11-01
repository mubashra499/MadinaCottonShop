/*
# Phase 2: Server-Side Order Status + Payment Verification Functions

## Summary
1. update_order_status() — SECURITY DEFINER function that validates the caller is staff, enforces valid state transitions, logs the change, and creates a notification
2. verify_payment() — SECURITY DEFINER function for owner to verify a payment proof, marks payment as paid/failed, updates order payment_status, logs the action

## Why
Previously the admin page directly updated orders.status via the Supabase client. This meant:
- Any authenticated user could change any order's status (RLS permitting)
- No state transition validation (could go from 'delivered' back to 'new')
- No audit trail for status changes
- Payment verification was not server-enforced

Now both operations go through SECURITY DEFINER functions with internal is_staff() checks.
*/

-- ============================================================
-- 1. update_order_status() — validated state transitions
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status text;
  v_order_number text;
  v_user_id uuid;
  v_valid_transitions jsonb;
  v_allowed text[];
BEGIN
  -- Must be staff
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  -- Get current status
  SELECT status, order_number INTO v_old_status, v_order_number
  FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- No-op if same status
  IF v_old_status = p_new_status THEN
    RETURN;
  END IF;

  -- Define valid forward transitions
  v_allowed := ARRAY[
    'new->confirmed', 'new->cancelled', 'new->payment_pending',
    'payment_pending->confirmed', 'payment_pending->cancelled',
    'confirmed->processing', 'confirmed->cancelled',
    'processing->production', 'processing->packed', 'processing->cancelled',
    'production->quality_check', 'production->packed',
    'quality_check->packed', 'quality_check->production',
    'packed->shipped', 'packed->cancelled',
    'shipped->out_for_delivery',
    'out_for_delivery->delivered',
    'delivered->return_requested',
    'return_requested->return_approved', 'return_requested->cancelled',
    'return_approved->returned',
    'returned->refund_pending',
    'refund_pending->refunded',
    'new->refunded', 'confirmed->refunded', 'processing->refunded'
  ];

  IF NOT (v_old_status || '->' || p_new_status = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', v_old_status, p_new_status;
  END IF;

  -- Update order
  UPDATE orders SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id;

  -- Create status history
  INSERT INTO order_status_history (order_id, status, notes, changed_by)
  VALUES (p_order_id, p_new_status, COALESCE(p_notes, ''), v_user_id);

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (v_user_id, 'order_status_changed', 'order', p_order_id::text,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status));

  -- Notify the customer
  INSERT INTO notifications (user_id, type, title, body, read)
  SELECT user_id, 'order_update', 'Order ' || v_order_number || ' - ' || p_new_status,
         COALESCE(p_notes, 'Your order status has been updated.'), false
  FROM orders WHERE id = p_order_id;
END;
$function$;

-- Revoke from anon, allow authenticated (function checks is_staff internally)
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;

-- ============================================================
-- 2. verify_payment() — owner verifies payment proof
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_payment(
  p_payment_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment record;
  v_order_id uuid;
  v_user_id uuid;
BEGIN
  -- Must be staff
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  -- Validate decision
  IF p_decision NOT IN ('paid', 'failed') THEN
    RAISE EXCEPTION 'Invalid decision: must be paid or failed';
  END IF;

  -- Get payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  v_order_id := v_payment.order_id;

  -- Update payment record
  UPDATE payments
  SET status = p_decision,
      verified_at = now(),
      verified_by = v_user_id
  WHERE id = p_payment_id;

  -- If paid, update order payment status
  IF p_decision = 'paid' THEN
    UPDATE orders SET payment_status = 'paid', updated_at = now()
    WHERE id = v_order_id;

    -- Auto-confirm the order if it was new/payment_pending
    UPDATE orders SET status = 'confirmed', updated_at = now()
    WHERE id = v_order_id AND status IN ('new', 'payment_pending');

    -- Create status history for confirmation
    INSERT INTO order_status_history (order_id, status, notes, changed_by)
    SELECT v_order_id, 'confirmed', 'Payment verified - auto-confirmed', v_user_id
    WHERE EXISTS (SELECT 1 FROM orders WHERE id = v_order_id AND status = 'confirmed');
  ELSIF p_decision = 'failed' THEN
    UPDATE orders SET payment_status = 'failed', updated_at = now()
    WHERE id = v_order_id;
  END IF;

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (v_user_id, 'payment_verified', 'payment', p_payment_id::text,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', p_decision, 'notes', p_notes));

  -- Notify customer
  INSERT INTO notifications (user_id, type, title, body, read)
  SELECT user_id, 'payment_update',
    'Payment ' || CASE WHEN p_decision = 'paid' THEN 'Verified' ELSE 'Failed' END,
    COALESCE(p_notes, 'Your payment status has been updated.'), false
  FROM orders WHERE id = v_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) FROM anon;
