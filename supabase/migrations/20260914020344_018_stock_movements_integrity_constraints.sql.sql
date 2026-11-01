/*
# Stock Movements, Back-in-Stock Alerts, and Database Integrity

## New Tables
1. `stock_movements` — Track every stock change with reason
2. `back_in_stock_alerts` — Customer signup for notifications when products return

## Constraints
- Products: non-negative stock (CHECK constraint)
- Product variants: non-negative stock
- Materials: non-negative stock
- Orders: non-negative financial fields

## Security
- stock_movements: owner-only write, owner-only read
- back_in_stock_alerts: customer creates their own, owner reads all
*/

-- ============================================================
-- 1. STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  change_type text NOT NULL DEFAULT 'adjustment',
  quantity_change integer NOT NULL,
  previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0,
  reason text DEFAULT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_owner_select" ON public.stock_movements;
CREATE POLICY "stock_movements_owner_select"
ON public.stock_movements FOR SELECT
TO authenticated USING (public.is_owner());

DROP POLICY IF EXISTS "stock_movements_owner_insert" ON public.stock_movements;
CREATE POLICY "stock_movements_owner_insert"
ON public.stock_movements FOR INSERT
TO authenticated WITH CHECK (public.is_owner());

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at);

-- ============================================================
-- 2. BACK-IN-STOCK ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.back_in_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text DEFAULT NULL,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.back_in_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Customer can create their own alerts, owner can see all
DROP POLICY IF EXISTS "back_in_stock_alerts_select" ON public.back_in_stock_alerts;
CREATE POLICY "back_in_stock_alerts_select"
ON public.back_in_stock_alerts FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "back_in_stock_alerts_customer_insert" ON public.back_in_stock_alerts;
CREATE POLICY "back_in_stock_alerts_customer_insert"
ON public.back_in_stock_alerts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "back_in_stock_alerts_customer_delete" ON public.back_in_stock_alerts;
CREATE POLICY "back_in_stock_alerts_customer_delete"
ON public.back_in_stock_alerts FOR DELETE
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "back_in_stock_alerts_owner_update" ON public.back_in_stock_alerts;
CREATE POLICY "back_in_stock_alerts_owner_update"
ON public.back_in_stock_alerts FOR UPDATE
TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE INDEX IF NOT EXISTS idx_back_in_stock_product ON public.back_in_stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_back_in_stock_notified ON public.back_in_stock_alerts(notified);

-- ============================================================
-- 3. DATABASE INTEGRITY CONSTRAINTS
-- ============================================================

-- Non-negative stock on products
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonneg') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative low_stock_threshold
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_low_stock_nonneg') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_low_stock_nonneg CHECK (low_stock_threshold >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative prices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_price_nonneg') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_price_nonneg CHECK (price >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative variant stock
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_nonneg') THEN
    ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_stock_nonneg CHECK (stock >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative variant price
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_price_nonneg') THEN
    ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_price_nonneg CHECK (price >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative order totals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_nonneg') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_total_nonneg CHECK (total >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_subtotal_nonneg') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_subtotal_nonneg CHECK (subtotal >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative material stock
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materials_stock_nonneg') THEN
    ALTER TABLE public.materials ADD CONSTRAINT materials_stock_nonneg CHECK (stock >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative expense amount
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_pos') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_pos CHECK (amount > 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Positive order item quantity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_qty_pos') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_qty_pos CHECK (quantity > 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Non-negative order item unit_price
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_price_nonneg') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_price_nonneg CHECK (unit_price >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 4. ORDER STATE MACHINE VALIDATION
-- ============================================================
-- Create a function to validate order status transitions
CREATE OR REPLACE FUNCTION public.validate_order_transition(
  p_current text,
  p_new text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
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

-- Update the update_order_status function to validate transitions
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status text;
BEGIN
  -- Only owner can update order status
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized to update order status';
  END IF;

  SELECT status INTO v_current_status FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Validate state transition
  IF NOT public.validate_order_transition(v_current_status, p_new_status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
  END IF;

  -- Update order status
  UPDATE public.orders SET status = p_new_status, updated_at = now() WHERE id = p_order_id;

  -- Create status history entry
  INSERT INTO public.order_status_history (order_id, status, notes, changed_by)
  VALUES (p_order_id, p_new_status, p_notes, auth.uid());

  -- Log the action
  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (auth.uid(), 'order_status_changed', 'order', p_order_id::text,
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', p_new_status, 'notes', p_notes));

  -- Notify the customer
  INSERT INTO public.notifications (user_id, type, title, body)
  SELECT o.user_id, 'order_update',
    'Order Status Updated',
    'Your order ' || o.order_number || ' is now: ' || p_new_status
  FROM public.orders o WHERE o.id = p_order_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;