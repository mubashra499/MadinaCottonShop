/*
# Phase 2: Data Integrity + Payment Record in place_order

## Summary
1. Add payment record creation to place_order() for online payments
2. Add CHECK constraints to prevent negative stock
3. Add CHECK constraints on order_items for positive quantity and non-negative price
4. Add CHECK constraints on orders for non-negative financials
5. Add order status CHECK constraint (includes existing 'payment_pending' status)
6. Add payment status CHECK constraint
*/

-- ============================================================
-- 1. Update place_order to also create payment record
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_delivery_name text,
  p_delivery_phone text,
  p_delivery_email text DEFAULT NULL,
  p_country text DEFAULT 'Pakistan',
  p_city text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_landmark text DEFAULT NULL,
  p_delivery_instructions text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT 'cod',
  p_payment_reference text DEFAULT NULL,
  p_payment_proof_url text DEFAULT NULL,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_coupon_code text DEFAULT NULL,
  p_coupon_discount numeric DEFAULT 0,
  p_is_gift boolean DEFAULT false,
  p_gift_recipient_name text DEFAULT NULL,
  p_gift_message text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item_price numeric;
  v_item_total numeric;
  v_item_quantity int;
  v_product record;
  v_variant record;
  v_item jsonb;
  v_coupon_id uuid;
  v_coupon_type text;
  v_coupon_value numeric;
  v_max_discount numeric;
  v_coupon_min_order numeric;
  v_coupon_per_limit int;
  v_new_stock int;
  v_new_variant_stock int;
  v_discount numeric := 0;
  v_shipping numeric := 0;
  v_zone record;
  v_coupon_already_used boolean;
  v_payment_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  v_order_number := 'MCS-' || UPPER(SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 8));
  v_tracking_token := REPLACE(GEN_RANDOM_UUID()::text, '-', '');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_quantity := (v_item->>'quantity')::int;
    IF v_item_quantity IS NULL OR v_item_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product: %', v_item->>'product_id';
    END IF;

    SELECT price, sale_price, stock, made_to_order, status INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    IF v_product.status != 'active' THEN
      RAISE EXCEPTION 'Product not available: %', v_item->>'product_id';
    END IF;

    IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> '' THEN
      SELECT price, sale_price, stock INTO v_variant
      FROM product_variants WHERE id = (v_item->>'variant_id')::uuid AND product_id = (v_item->>'product_id')::uuid;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
      END IF;

      v_item_price := COALESCE(v_variant.sale_price, v_variant.price);
    ELSE
      v_item_price := COALESCE(v_product.sale_price, v_product.price);
    END IF;

    v_item_total := v_item_price * v_item_quantity;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  IF p_delivery_zone_id IS NOT NULL THEN
    SELECT delivery_fee, min_order, free_delivery_threshold INTO v_zone
    FROM delivery_zones WHERE id = p_delivery_zone_id AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery zone';
    END IF;

    IF v_zone.min_order IS NOT NULL AND v_subtotal < v_zone.min_order THEN
      RAISE EXCEPTION 'Order does not meet minimum amount for this delivery zone';
    END IF;

    IF v_zone.free_delivery_threshold IS NOT NULL AND v_subtotal >= v_zone.free_delivery_threshold THEN
      v_shipping := 0;
    ELSE
      v_shipping := COALESCE(v_zone.delivery_fee, 0);
    END IF;
  ELSE
    v_shipping := p_shipping_fee;
  END IF;

  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT id, discount_type, value, max_discount, min_order, per_customer_limit
    INTO v_coupon_id, v_coupon_type, v_coupon_value, v_max_discount, v_coupon_min_order, v_coupon_per_limit
    FROM coupons
    WHERE code = p_coupon_code
      AND active = true
      AND (start_date IS NULL OR start_date <= now())
      AND (end_date IS NULL OR end_date >= now())
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    LIMIT 1;

    IF v_coupon_id IS NOT NULL THEN
      IF v_coupon_min_order IS NOT NULL AND v_subtotal < v_coupon_min_order THEN
        RAISE EXCEPTION 'Coupon requires minimum order of %', v_coupon_min_order;
      END IF;

      IF v_coupon_per_limit IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 FROM coupon_usage WHERE coupon_id = v_coupon_id AND user_id = auth.uid()
        ) INTO v_coupon_already_used;
        IF v_coupon_already_used THEN
          RAISE EXCEPTION 'Coupon already used';
        END IF;
      END IF;

      IF v_coupon_type = 'percentage' THEN
        v_discount := v_subtotal * (v_coupon_value / 100.0);
        IF v_max_discount IS NOT NULL THEN
          v_discount := LEAST(v_discount, v_max_discount);
        END IF;
      ELSIF v_coupon_type = 'fixed' THEN
        v_discount := v_coupon_value;
      ELSE
        v_discount := v_coupon_value;
      END IF;

      v_discount := LEAST(v_discount, v_subtotal);
    ELSE
      v_discount := 0;
    END IF;
  ELSE
    v_discount := 0;
  END IF;

  v_total := v_subtotal - v_discount + v_shipping;

  IF p_payment_method = 'cod' THEN
    v_payment_status := 'pending';
  ELSE
    v_payment_status := 'proof_submitted';
  END IF;

  INSERT INTO orders (
    order_number, user_id, status, subtotal, discount, shipping_fee, total,
    currency, payment_method, payment_status,
    customer_name, customer_phone, customer_email,
    country, city, address, area, postal_code, landmark,
    delivery_instructions, notes,
    tracking_token, coupon_code, coupon_discount,
    is_gift, gift_recipient_name, gift_message
  ) VALUES (
    v_order_number, auth.uid(), 'new', v_subtotal, v_discount, v_shipping, v_total,
    'PKR', p_payment_method, v_payment_status,
    p_delivery_name, p_delivery_phone, p_delivery_email,
    p_country, p_city, p_address, p_area, p_postal_code, p_landmark,
    p_delivery_instructions, p_notes,
    v_tracking_token, p_coupon_code, v_discount,
    p_is_gift, p_gift_recipient_name, p_gift_message
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_quantity := (v_item->>'quantity')::int;

    SELECT name, made_to_order INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;

    IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> '' THEN
      SELECT price, sale_price, stock, size_label, weight, filling, fabric, color, design, stitching, decoration
      INTO v_variant
      FROM product_variants WHERE id = (v_item->>'variant_id')::uuid;

      v_item_price := COALESCE(v_variant.sale_price, v_variant.price);

      UPDATE product_variants
      SET stock = stock - v_item_quantity
      WHERE id = (v_item->>'variant_id')::uuid
        AND stock >= v_item_quantity
      RETURNING stock INTO v_new_variant_stock;

      IF v_new_variant_stock IS NULL THEN
        RAISE EXCEPTION 'Insufficient stock for variant: %', v_item->>'variant_id';
      END IF;
    ELSE
      v_item_price := COALESCE(v_product.sale_price, v_product.price);
    END IF;

    IF NOT v_product.made_to_order THEN
      UPDATE products
      SET stock = stock - v_item_quantity
      WHERE id = (v_item->>'product_id')::uuid
        AND stock >= v_item_quantity
      RETURNING stock INTO v_new_stock;

      IF v_new_stock IS NULL THEN
        RAISE EXCEPTION 'Insufficient stock for product: %', v_item->>'product_id';
      END IF;
    END IF;

    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name,
      size_label, weight, filling, fabric, color, design, stitching, decoration,
      quantity, unit_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      NULLIF(v_item->>'variant_id', '')::uuid,
      v_product.name,
      v_variant.size_label, v_variant.weight, v_variant.filling, v_variant.fabric,
      v_variant.color, v_variant.design, v_variant.stitching, v_variant.decoration,
      v_item_quantity,
      v_item_price
    );
  END LOOP;

  INSERT INTO order_status_history (order_id, status, notes, changed_by)
  VALUES (v_order_id, 'new', 'Order placed by customer', auth.uid());

  -- Create payment record for online payments (server-side only)
  IF p_payment_method != 'cod' THEN
    INSERT INTO payments (order_id, method, amount, status, transaction_ref, proof_url)
    VALUES (v_order_id, p_payment_method, v_total, 'submitted', p_payment_reference, p_payment_proof_url);
  END IF;

  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon_id;
    INSERT INTO coupon_usage (coupon_id, user_id, order_id)
    VALUES (v_coupon_id, auth.uid(), v_order_id);
  END IF;

  INSERT INTO notifications (user_id, type, title, body, read)
  SELECT id, 'order', 'New Order: ' || v_order_number, 'Order from ' || p_delivery_name, false
  FROM profiles WHERE role IN ('owner', 'admin');

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'tracking_token', v_tracking_token,
    'total', v_total
  );
END;
$function$;

-- ============================================================
-- 2. CHECK constraints: prevent negative stock
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonneg' AND conrelid = 'products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_nonneg' AND conrelid = 'product_variants'::regclass) THEN
    ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_nonneg CHECK (stock >= 0);
  END IF;
END $$;

-- ============================================================
-- 3. CHECK constraints: order_items positive quantity, non-negative price
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_qty_pos' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_qty_pos CHECK (quantity > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_price_nonneg' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_price_nonneg CHECK (unit_price >= 0);
  END IF;
END $$;

-- ============================================================
-- 4. CHECK constraints: orders non-negative financials
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_subtotal_nonneg' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_subtotal_nonneg CHECK (subtotal >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_discount_nonneg' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_discount_nonneg CHECK (discount >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_nonneg' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shipping_nonneg CHECK (shipping_fee >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_nonneg' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_total_nonneg CHECK (total >= 0);
  END IF;
END $$;

-- ============================================================
-- 5. CHECK constraint: order status valid values (includes existing 'payment_pending')
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_valid' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN (
      'new', 'payment_pending', 'confirmed', 'processing', 'production', 'quality_check',
      'packed', 'shipped', 'out_for_delivery', 'delivered',
      'cancelled', 'return_requested', 'return_approved', 'returned',
      'refund_pending', 'refunded'
    ));
  END IF;
END $$;

-- ============================================================
-- 6. CHECK constraint: payment status valid values
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_valid' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_status_valid CHECK (status IN (
      'pending', 'submitted', 'processing', 'paid', 'failed',
      'cancelled', 'refunded', 'partially_refunded'
    ));
  END IF;
END $$;

-- ============================================================
-- 7. CHECK constraint: payments amount non-negative
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_pos' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_amount_pos CHECK (amount >= 0);
  END IF;
END $$;
