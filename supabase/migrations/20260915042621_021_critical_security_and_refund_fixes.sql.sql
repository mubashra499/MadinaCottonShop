/*
# Critical security + data integrity fixes

## Changes
1. REVOKE anon EXECUTE on verify_payment with CORRECT signature (uuid, text, text)
2. Add FOR UPDATE row locking to update_order_status
3. Create process_refund function with amount validation + stock restoration
4. Add stock_movements data quality constraints (at least one ID non-null, change_type CHECK)
5. Add order status transition trigger on orders table (defense-in-depth)
6. Add material_id to stock_movements for material tracking
*/

-- ============================================================
-- 1. Fix verify_payment anon REVOKE (was using wrong signature)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_payment(uuid, text, text) TO authenticated;

-- ============================================================
-- 2. Harden update_order_status with FOR UPDATE row locking
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
  v_current_status text;
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized to update order status';
  END IF;

  v_user_id := auth.uid();

  -- Lock the order row FOR UPDATE to prevent concurrent status changes
  SELECT status INTO v_current_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Validate transition
  IF NOT public.validate_order_transition(v_current_status, p_new_status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
  END IF;

  -- Update order status
  UPDATE public.orders
  SET status = p_new_status, updated_at = now()
  WHERE id = p_order_id;

  -- Record status history
  INSERT INTO public.order_status_history (order_id, status, notes, changed_by)
  VALUES (p_order_id, p_new_status, COALESCE(p_notes, 'Status updated by owner'), v_user_id);

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (
    v_user_id,
    'ORDER_STATUS_CHANGE',
    'orders',
    p_order_id,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', p_new_status, 'notes', p_notes)
  );

  -- Notify customer
  INSERT INTO public.notifications (user_id, type, title, body, read)
  SELECT o.user_id, 'order_update',
    'Order ' || o.order_number || ' — ' || p_new_status,
    COALESCE(p_notes, 'Your order status has been updated to: ' || p_new_status),
    false
  FROM public.orders o
  WHERE o.id = p_order_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- ============================================================
-- 3. Create process_refund function
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_refund(
  p_order_id uuid,
  p_refund_amount numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_payment record;
  v_refund_amount numeric;
  v_total_refunded numeric := 0;
  v_user_id uuid;
  v_prev_stock int;
  v_new_stock int;
  v_item record;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized to process refunds';
  END IF;

  v_user_id := auth.uid();

  -- Lock order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Order must be in a refund-eligible state
  IF v_order.status NOT IN ('cancelled', 'returned', 'delivered', 'refund_pending') THEN
    RAISE EXCEPTION 'Order in status % is not eligible for refund', v_order.status;
  END IF;

  -- Default refund amount to order total if not specified
  v_refund_amount := COALESCE(p_refund_amount, v_order.total);

  -- Refund cannot exceed order total
  IF v_refund_amount > v_order.total THEN
    RAISE EXCEPTION 'Refund amount % exceeds order total %', v_refund_amount, v_order.total;
  END IF;

  -- Refund must be positive
  IF v_refund_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  -- Check previous refunds (idempotency: if already fully refunded, reject)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
  FROM public.payments
  WHERE order_id = p_order_id AND status = 'refunded';

  IF v_total_refunded + v_refund_amount > v_order.total THEN
    RAISE EXCEPTION 'Total refunds (% + %) would exceed order total %',
      v_total_refunded, v_refund_amount, v_order.total;
  END IF;

  -- Lock payment row and update
  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_id = p_order_id AND status = 'paid'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'No paid payment found to refund';
  END IF;

  -- Update payment status to refunded
  UPDATE public.payments
  SET status = 'refunded', updated_at = now()
  WHERE id = v_payment.id;

  -- Update order status to refunded
  UPDATE public.orders
  SET status = 'refunded', updated_at = now()
  WHERE id = p_order_id;

  -- Restore stock for each order item (if order was cancelled/returned)
  FOR v_item IN
    SELECT oi.*, p.stock as product_stock, p.made_to_order, pv.stock as variant_stock
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = p_order_id
  LOOP
    IF NOT v_item.made_to_order THEN
      -- Restore product stock
      IF v_item.product_stock IS NOT NULL THEN
        v_prev_stock := v_item.product_stock;
        UPDATE public.products
        SET stock = stock + v_item.quantity
        WHERE id = v_item.product_id
        RETURNING stock INTO v_new_stock;

        INSERT INTO public.stock_movements (product_id, change_type, quantity_change, previous_stock, new_stock, reason)
        VALUES (v_item.product_id, 'return', v_item.quantity, v_prev_stock, v_new_stock, 'Refund for order: ' || v_order.order_number);
      END IF;

      -- Restore variant stock
      IF v_item.variant_id IS NOT NULL AND v_item.variant_stock IS NOT NULL THEN
        v_prev_stock := v_item.variant_stock;
        UPDATE public.product_variants
        SET stock = stock + v_item.quantity
        WHERE id = v_item.variant_id
        RETURNING stock INTO v_new_stock;

        INSERT INTO public.stock_movements (variant_id, product_id, change_type, quantity_change, previous_stock, new_stock, reason)
        VALUES (v_item.variant_id, v_item.product_id, 'return', v_item.quantity, v_prev_stock, v_new_stock, 'Refund for order: ' || v_order.order_number);
      END IF;
    END IF;
  END LOOP;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (
    v_user_id,
    'REFUND',
    'orders',
    p_order_id,
    jsonb_build_object('status', v_order.status, 'total_refunded_before', v_total_refunded),
    jsonb_build_object('status', 'refunded', 'refund_amount', v_refund_amount, 'reason', p_reason)
  );

  -- Notify customer
  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    v_order.user_id, 'refund', 'Refund Processed',
    'A refund of Rs. ' || v_refund_amount || ' has been processed for your order ' || v_order.order_number || '. ' || COALESCE(p_reason, ''),
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'refund_amount', v_refund_amount,
    'total_refunded', v_total_refunded + v_refund_amount
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_refund(uuid, numeric, text) TO authenticated;

-- ============================================================
-- 4. Stock movements data quality constraints
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_entity_check'
  ) THEN
    ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_entity_check
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_change_type_check'
  ) THEN
    ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_change_type_check
    CHECK (change_type IN (
      'purchase', 'sale', 'reservation', 'reservation_release',
      'adjustment', 'damage', 'return', 'refund',
      'production_consumption', 'transfer'
    ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_consistency_check'
  ) THEN
    ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_consistency_check
    CHECK (new_stock = previous_stock + quantity_change);
  END IF;
END $$;

-- ============================================================
-- 5. Order status transition trigger (defense-in-depth)
--    Prevents direct UPDATEs that bypass update_order_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
BEGIN
  -- Only validate when status actually changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_old_status := OLD.status;
    v_new_status := NEW.status;

    -- Allow the transition if validated
    IF NOT public.validate_order_transition(v_old_status, v_new_status) THEN
      RAISE EXCEPTION 'Invalid order status transition from % to % (enforced by trigger)',
        v_old_status, v_new_status;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_status_transition_check ON public.orders;
CREATE TRIGGER orders_status_transition_check
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_status_transition();

REVOKE EXECUTE ON FUNCTION public.enforce_order_status_transition() FROM anon;

-- ============================================================
-- 6. Add material tracking to stock_movements
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
    AND column_name = 'material_id'
  ) THEN
    ALTER TABLE public.stock_movements
    ADD COLUMN material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update entity check to include materials
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_entity_check'
  ) THEN
    ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_entity_check;
  END IF;
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_entity_check
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL OR material_id IS NOT NULL);
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON public.stock_movements(material_id);
